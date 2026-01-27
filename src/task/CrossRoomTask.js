/**
 * 跨房间任务管理器
 * 管理需要跨房间协作的任务
 */

const logger = require('../core/Logger');
const MemoryManager = require('../core/MemoryManager');
const TaskReleaser = require('./TaskReleaser');
const Constants = require('../config/Constants');

class CrossRoomTask {
    /**
     * 处理跨房间任务
     */
    static process() {
        const colony = MemoryManager.getColonyMemory();
        if (!colony.crossRoomTasks) return;

        // 处理运输任务
        this.processTransportTasks(colony.crossRoomTasks.transport);

        // 处理攻击任务
        this.processAttackTasks(colony.crossRoomTasks.attack);

        // 处理扩张任务
        this.processExpandTasks(colony.crossRoomTasks.expand);
    }

    /**
     * 处理跨房间运输任务
     * @param {Array} tasks - 运输任务列表
     */
    static processTransportTasks(tasks) {
        // TODO: 实现跨房间运输任务分配逻辑
        // 当前阶段仅预留接口
        for (const task of tasks) {
            if (!task.creepId) {
                // 寻找可用的 Carrier
                const availableCarriers = _.filter(Game.creeps, creep =>
                    creep.memory.role === 'carrier' &&
                    !creep.memory.inTask
                );

                if (availableCarriers.length > 0) {
                    const carrier = availableCarriers[0];
                    task.creepId = carrier.id;
                    carrier.memory.inTask = true;
                    carrier.memory.task = task;
                    logger.debug(`Assigned cross-room transport task to ${carrier.name}`);
                }
            }
        }
    }

    /**
     * 处理跨房间攻击任务
     * @param {Array} tasks - 攻击任务列表
     */
    static processAttackTasks(tasks) {
        // TODO: 实现跨房间攻击任务分配逻辑
        logger.debug(`Processing ${tasks.length} cross-room attack tasks`);
    }

    /**
     * 处理跨房间扩张任务
     * @param {Array} tasks - 扩张任务列表
     */
    static processExpandTasks(tasks) {
        // TODO: 实现跨房间扩张任务分配逻辑
        logger.debug(`Processing ${tasks.length} cross-room expand tasks`);
    }

    /**
     * 创建跨房间运输任务
     * @param {string} fromRoom - 源房间
     * @param {string} toRoom - 目标房间
     * @param {string} resourceType - 资源类型
     * @param {number} amount - 数量
     */
    static createTransportTask(fromRoom, toRoom, resourceType = RESOURCE_ENERGY, amount = 1000) {
        const fromRoomObj = Game.rooms[fromRoom];
        const toRoomObj = Game.rooms[toRoom];

        if (!fromRoomObj || !toRoomObj) {
            logger.warn(`Cannot create transport task: rooms not found`);
            return false;
        }

        // 查找源存储
        const sourceStorage = fromRoomObj.storage || fromRoomObj.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                        s.store.getUsedCapacity(resourceType) > 0
        })[0];

        // 查找目标存储
        const targetStorage = toRoomObj.storage || toRoomObj.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                        s.store.getFreeCapacity(resourceType) > 0
        })[0];

        if (!sourceStorage || !targetStorage) {
            return false;
        }

        return TaskReleaser.releaseTask(
            fromRoomObj,
            Constants.TASK_TYPES.DELIVERY,
            sourceStorage.pos,
            targetStorage.pos,
            targetStorage.id,
            5, // 中等优先级
            { resourceType: resourceType, amount: amount },
            true, // 跨房间任务
            toRoom
        );
    }
}

module.exports = CrossRoomTask;
