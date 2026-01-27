/**
 * 生成管理器
 * 协调 Spawn 的生成任务
 */

const logger = require('../core/Logger');
const ErrorHandler = require('../core/ErrorHandler');
const SpawnScheduler = require('./SpawnScheduler');
const BodyBuilder = require('./BodyBuilder');
const CostCalculator = require('./CostCalculator');
const MemoryManager = require('../core/MemoryManager');
const Constants = require('../config/Constants');

class SpawnManager {
    /**
     * 检查是否有可用的搬运工
     * @param {Room} room - 房间对象
     * @returns {boolean}
     */
    static hasAvailableCarrier(room) {
        const carriers = _.filter(Game.creeps, creep => 
            creep.memory.role === 'carrier' && 
            creep.memory.room === room.name &&
            !creep.spawning
        );
        
        // 检查是否有carrier没有任务（可以搬运能量）
        for (const carrier of carriers) {
            if (!carrier.memory.inTask) {
                return true;
            }
            // 检查carrier是否在执行delivery任务（可能正在搬运能量到spawn）
            const task = carrier.memory.task;
            if (task && task.type === 'delivery') {
                const target = Game.getObjectById(task.releaserId);
                if (target && (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * 检查是否应该等待能量补充
     * @param {Room} room - 房间对象
     * @param {number} priority - 生成优先级
     * @returns {boolean}
     */
    static shouldWaitForEnergy(room, priority) {
        const availableEnergy = room.energyAvailable;
        const energyCapacity = room.energyCapacityAvailable;
        
        // P0和P1优先级（harvesterpro和carrier）应该立即生成，不等待
        if (priority <= Constants.SPAWN_PRIORITY.P1) {
            return false;
        }
        
        // 如果能量已经达到最大，不需要等待
        if (availableEnergy >= energyCapacity) {
            return false;
        }
        
        // 如果能量未满且有可用的搬运工，应该等待
        if (this.hasAvailableCarrier(room)) {
            // 计算能量缺口
            const energyGap = energyCapacity - availableEnergy;
            // 如果能量缺口较大（超过100），等待搬运工补充
            if (energyGap > 100) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 接受生成任务
     * @param {StructureSpawn} spawn - Spawn 对象
     */
    static acceptTask(spawn) {
        ErrorHandler.safeExecute(() => {
            const room = spawn.room;
            const roomMemory = MemoryManager.getRoomMemory(room.name);

            if (!roomMemory || !roomMemory.localTasks) {
                return;
            }

            // 如果 Spawn 正在生成，跳过
            if (spawn.spawning) {
                return;
            }

            // 获取生成队列
            const roleConfigs = require('../role.config');
            const queue = SpawnScheduler.generateSpawnQueue(room, roleConfigs);

            if (queue.length === 0) {
                return;
            }

            // 处理队列中的第一个任务（最高优先级）
            const task = queue[0];
            
            // 检查是否应该等待能量补充（避免生成小型低效creeps）
            if (this.shouldWaitForEnergy(room, task.priority)) {
                logger.debug(`${spawn.name}: Waiting for carrier to fill energy before spawning ${task.role}`);
                return;
            }
            
            const result = this.spawnCreep(spawn, task.role, task.config);

            if (result === OK) {
                logger.info(`${spawn.name}: Spawning ${task.role} (priority ${task.priority})`);
            } else if (result !== ERR_BUSY && result !== ERR_NOT_ENOUGH_ENERGY) {
                logger.warn(`${spawn.name}: Failed to spawn ${task.role}, error: ${result}`);
            }
        }, `SpawnManager.acceptTask(${spawn.name})`);
    }

    /**
     * 生成 Creep
     * @param {StructureSpawn} spawn - Spawn 对象
     * @param {string} role - 角色名称
     * @param {Object} roleConfig - 角色配置
     * @returns {number} 生成结果代码
     */
    static spawnCreep(spawn, role, roleConfig) {
        const room = spawn.room;
        const availableEnergy = room.energyAvailable;
        const priority = SpawnScheduler.getPriority(role);

        // 检查是否可以生成（根据优先级）
        if (!SpawnScheduler.canSpawnByPriority(spawn, priority)) {
            return ERR_NOT_ENOUGH_ENERGY;
        }

        let body = null;

        // 选择生成方式
        if (roleConfig.auto) {
            // 自动组装模式（传入 room 以便检查 extension 能量）
            body = BodyBuilder.buildAutoBody(roleConfig, availableEnergy, room);
        } else {
            // 标准模式
            body = BodyBuilder.buildStandardBody(roleConfig, room.controller.level, availableEnergy);
        }

        if (!body || body.length === 0) {
            logger.warn(`Cannot build body for ${role}`);
            return ERR_INVALID_ARGS;
        }

        // 确保能量足够
        const cost = CostCalculator.calculateCost(body);
        if (cost > availableEnergy) {
            // 尝试构建最小配置
            body = BodyBuilder.buildMinimalBody((roleConfig.auto && roleConfig.auto.base) || [WORK, CARRY, MOVE]);
            const minCost = CostCalculator.calculateCost(body);
            if (minCost > availableEnergy) {
                return ERR_NOT_ENOUGH_ENERGY;
            }
        }

        // 生成名称
        const name = `${role}_${Game.time}`;

        // 生成 Creep
        const result = spawn.spawnCreep(body, name, {
            memory: {
                room: room.name,
                role: role,
                level: room.controller.level,
                inTask: false
            }
        });

        return result;
    }
}

module.exports = SpawnManager;
