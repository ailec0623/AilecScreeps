/**
 * 生成调度器
 * 实现能量运转优先的生成策略
 */

const logger = require('../core/Logger');
const Constants = require('../config/Constants');

class SpawnScheduler {
    /**
     * 计算房间需要的 Creep 数量
     * @param {Room} room - 房间对象
     * @param {string} role - 角色名称
     * @returns {number} 需要的数量
     */
    static calculateRequiredCount(room, role) {
        const roomMemory = Memory.colony_v2 && Memory.colony_v2.colony && Memory.colony_v2.colony.rooms && Memory.colony_v2.colony.rooms[room.name];
        if (!roomMemory) return 0;

        // 统计当前数量和生成中的数量
        // 优化：使用GameCache获取creeps，避免遍历所有creeps
        const GameCache = require('../core/GameCache');
        const creepNames = GameCache.getCreepsByRoom(room.name, role);
        const currentCount = creepNames.filter(name => Game.creeps[name]).length;

        // 统计生成队列中的数量
        const spawnTasks = roomMemory.localTasks && roomMemory.localTasks.spawn ? roomMemory.localTasks.spawn : [];
        const spawningCount = spawnTasks.filter(
            task => task.addition && task.addition.role === role
        ).length;

        const totalCount = currentCount + spawningCount;

        // 根据角色计算需要的数量
        switch (role) {
            case 'harvesterpro':
                // P0: 每个能量源至少 1 个
                const sources = room.find(FIND_SOURCES_ACTIVE);
                return Math.max(sources.length, 1);

            case 'carrier':
                // P1: 根据实际工作负载智能调整搬运工数量
                return this.calculateCarrierCount(room, roomMemory);

            case 'worker':
                // P2: 根据任务数量调整，但至少保证 1 个（用于升级控制器）
                const buildTasks = (roomMemory.localTasks && roomMemory.localTasks.build) ? roomMemory.localTasks.build.length : 0;
                const repairTasks = (roomMemory.localTasks && roomMemory.localTasks.repair) ? roomMemory.localTasks.repair.length : 0;
                const upgradeTasks = (roomMemory.localTasks && roomMemory.localTasks.upgrade) ? roomMemory.localTasks.upgrade.length : 0;
                const totalTasks = buildTasks + repairTasks + upgradeTasks;
                // 至少保证 1 个 worker，即使没有任务也要升级控制器
                return Math.max(1, Math.min(Math.ceil(totalTasks / 12), 3));

            default:
                return 0;
        }
    }

    /**
     * 计算需要的搬运工数量（基于实际工作负载）
     * @param {Room} room - 房间对象
     * @param {Object} roomMemory - 房间内存
     * @returns {number} 需要的搬运工数量
     */
    static calculateCarrierCount(room, roomMemory) {
        // 统计未分配的任务数量
        const deliveryTasks = (roomMemory.localTasks && roomMemory.localTasks.delivery) 
            ? roomMemory.localTasks.delivery.filter(t => !t.creepId).length : 0;
        const pickupTasks = (roomMemory.localTasks && roomMemory.localTasks.pickup) 
            ? roomMemory.localTasks.pickup.filter(t => !t.creepId).length : 0;
        const getenergyTasks = (roomMemory.localTasks && roomMemory.localTasks.getenergy) 
            ? roomMemory.localTasks.getenergy.filter(t => !t.creepId).length : 0;
        
        const unassignedTasks = deliveryTasks + pickupTasks + getenergyTasks;
        
        // 统计当前carrier的工作状态
        const GameCache = require('../core/GameCache');
        const carrierNames = GameCache.getCreepsByRoom(room.name, 'carrier');
        let busyCarriers = 0;  // 正在执行任务的carrier数量
        let idleCarriers = 0;  // 闲置的carrier数量
        
        for (const name of carrierNames) {
            const carrier = Game.creeps[name];
            if (!carrier || carrier.spawning) continue;
            
            if (carrier.memory.inTask) {
                busyCarriers++;
            } else {
                idleCarriers++;
            }
        }
        
        // 计算需要的carrier数量
        // 每个carrier平均可以处理15个任务（考虑往返时间）
        const tasksPerCarrier = 15;
        
        // 基础需求：至少1个carrier用于基本运输
        let requiredCount = 1;
        
        // 如果有未分配的任务，需要更多carrier
        if (unassignedTasks > 0) {
            // 计算处理所有未分配任务需要的carrier数量
            const carriersForTasks = Math.ceil(unassignedTasks / tasksPerCarrier);
            requiredCount = Math.max(requiredCount, carriersForTasks);
        }
        
        // 考虑已有carrier的工作状态
        // 如果已有足够的闲置carrier可以处理未分配任务，不需要生成新的
        if (idleCarriers > 0 && unassignedTasks <= idleCarriers * tasksPerCarrier) {
            // 有足够的闲置carrier，但至少保留1个
            requiredCount = Math.max(1, busyCarriers + Math.ceil(unassignedTasks / tasksPerCarrier));
        } else {
            // 需要更多carrier来处理任务
            requiredCount = Math.max(requiredCount, busyCarriers + Math.ceil(unassignedTasks / tasksPerCarrier));
        }
        
        // 考虑房间的能量需求
        // 如果有spawn或extension需要能量，至少需要1个carrier
        const spawns = room.find(FIND_MY_SPAWNS);
        const extensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        });
        
        // 检查是否有spawn或extension需要能量
        let needsEnergy = false;
        for (const spawn of spawns) {
            if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                needsEnergy = true;
                break;
            }
        }
        if (!needsEnergy) {
            for (const ext of extensions) {
                if (ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    needsEnergy = true;
                    break;
                }
            }
        }
        
        // 如果需要能量但没有carrier在执行delivery任务，至少需要1个
        if (needsEnergy && busyCarriers === 0 && idleCarriers === 0) {
            requiredCount = Math.max(requiredCount, 1);
        }
        
        // 限制最大数量，避免生成过多（上限设置为2）
        const maxCarriers = 2;
        requiredCount = Math.min(requiredCount, maxCarriers);
        
        return requiredCount;
    }

    /**
     * 检查是否需要生成某个角色
     * @param {Room} room - 房间对象
     * @param {string} role - 角色名称
     * @param {Object} roleConfig - 角色配置
     * @returns {boolean}
     */
    static shouldSpawn(room, role, roleConfig) {
        const requiredCount = this.calculateRequiredCount(room, role);
        // 优化：使用GameCache获取creeps，避免遍历所有creeps
        const GameCache = require('../core/GameCache');
        const creepNames = GameCache.getCreepsByRoom(room.name, role);
        const currentCount = creepNames.filter(name => Game.creeps[name]).length;

        // 如果当前数量少于需要的数量，需要生成
        return currentCount < requiredCount;
    }

    /**
     * 获取生成优先级
     * @param {string} role - 角色名称
     * @returns {number} 优先级（数字越小优先级越高）
     */
    static getPriority(role) {
        return Constants.ROLE_PRIORITY[role] !== undefined 
            ? Constants.ROLE_PRIORITY[role] 
            : Constants.SPAWN_PRIORITY.P3;
    }

    /**
     * 检查能量是否足够生成
     * @param {StructureSpawn} spawn - Spawn 对象
     * @param {Array<string>} body - 身体部件
     * @param {number} minEnergy - 最小能量要求
     * @returns {boolean}
     */
    static hasEnoughEnergy(spawn, body, minEnergy = 0) {
        const CostCalculator = require('./CostCalculator');
        const cost = CostCalculator.calculateCost(body);
        const availableEnergy = spawn.room.energyAvailable;
        
        return availableEnergy >= Math.max(cost, minEnergy);
    }

    /**
     * 根据能量状态决定是否可以生成
     * @param {StructureSpawn} spawn - Spawn 对象
     * @param {number} priority - 优先级
     * @returns {boolean}
     */
    static canSpawnByPriority(spawn, priority) {
        const availableEnergy = spawn.room.energyAvailable;
        const energyCapacity = spawn.room.energyCapacityAvailable;

        // P0 和 P1: 即使能量不足也要生成（最小配置）
        if (priority <= Constants.SPAWN_PRIORITY.P1) {
            return availableEnergy >= Constants.ENERGY_THRESHOLDS.CRITICAL;
        }

        // P2 (worker): 用于升级控制器，即使能量不足也要生成最小配置
        // 但如果有充足能量，可以生成更好的配置
        if (priority === Constants.SPAWN_PRIORITY.P2) {
            // 至少要有最小配置的能量（WORK + CARRY + MOVE = 200）
            return availableEnergy >= 200;
        }

        // P3: 需要充足能量
        return availableEnergy >= Constants.ENERGY_THRESHOLDS.HIGH || 
               availableEnergy >= energyCapacity * 0.8;
    }

    /**
     * 生成任务队列（按优先级排序）
     * @param {Room} room - 房间对象
     * @param {Object} roleConfigs - 所有角色配置
     * @returns {Array<Object>} 生成任务队列
     */
    static generateSpawnQueue(room, roleConfigs) {
        const queue = [];

        // 检查所有角色
        for (const role in roleConfigs) {
            const roleConfig = roleConfigs[role];
            const priority = this.getPriority(role);

            if (this.shouldSpawn(room, role, roleConfig)) {
                queue.push({
                    role: role,
                    priority: priority,
                    config: roleConfig
                });
            }
        }

        // 按优先级排序（数字越小优先级越高）
        queue.sort((a, b) => a.priority - b.priority);

        return queue;
    }
}

module.exports = SpawnScheduler;
