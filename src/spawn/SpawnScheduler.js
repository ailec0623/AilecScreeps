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
        const currentCount = _.filter(Game.creeps, creep => 
            creep.memory.role === role && 
            creep.memory.room === room.name
        ).length;

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
                // P1: 根据运输任务数量动态调整
                const deliveryTasks = (roomMemory.localTasks && roomMemory.localTasks.delivery) ? roomMemory.localTasks.delivery.length : 0;
                const pickupTasks = (roomMemory.localTasks && roomMemory.localTasks.pickup) ? roomMemory.localTasks.pickup.length : 0;
                return 1 + Math.min(Math.ceil((deliveryTasks + pickupTasks) / 8), 3);

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
     * 检查是否需要生成某个角色
     * @param {Room} room - 房间对象
     * @param {string} role - 角色名称
     * @param {Object} roleConfig - 角色配置
     * @returns {boolean}
     */
    static shouldSpawn(room, role, roleConfig) {
        const requiredCount = this.calculateRequiredCount(room, role);
        const currentCount = _.filter(Game.creeps, creep => 
            creep.memory.role === role && 
            creep.memory.room === room.name
        ).length;

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
