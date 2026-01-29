const MemoryManager = require('../core/MemoryManager');
const Constants = require('../config/Constants');

/**
 * TaskPool / RoomTaskManager
 * 统一管理 MemoryManager.colony 上的任务池访问与简单操作。
 * 目前主要为 BaseRole.findAvailableTask / assignTask 提供封装，后续可以承接旧 src/task.js 的职责。
 */
const TaskPool = {
    /**
     * 获取指定房间的某类任务列表（直接引用内存数组）。
     * @param {string} roomName
     * @param {string} taskType
     * @returns {Array<Object>}
     */
    getTasksForRoom(roomName, taskType) {
        const roomMemory = MemoryManager.getRoomMemory(roomName);
        if (!roomMemory || !roomMemory.localTasks) return [];
        return roomMemory.localTasks[taskType] || [];
    },

    /**
     * 在指定房间查找一个“最佳可用任务”（未分配 + 过滤器命中 + 优先级最低）。
     * 行为与 BaseRole.findAvailableTask 的 roomName 分支保持一致。
     * @param {string} roomName
     * @param {string} taskType
     * @param {Function|null} filter
     * @returns {Object|null}
     */
    findBestLocalTask(roomName, taskType, filter = null) {
        const taskList = this.getTasksForRoom(roomName, taskType);
        let bestTask = null;
        let bestPriority = Infinity;

        for (const task of taskList) {
            if (task.creepId) continue;
            if (filter && !filter(task)) continue;

            const priority = task.priority || 0;
            if (priority < bestPriority) {
                bestTask = task;
                bestPriority = priority;
                if (priority <= 1) {
                    break;
                }
            }
        }

        return bestTask;
    },

    /**
     * 在全殖民地范围内查找某类任务（本地 + 跨房间）。
     * 行为与 BaseRole.findAvailableTask 的“跨房间”分支一致。
     * @param {string} taskType
     * @param {Function|null} filter
     * @returns {Object|null}
     */
    findBestGlobalTask(taskType, filter = null) {
        const colony = MemoryManager.getColonyMemory();
        let bestTask = null;
        let bestPriority = Infinity;

        // 1. 遍历所有房间的本地任务
        for (const roomName in colony.rooms) {
            const roomMemory = colony.rooms[roomName];
            if (!roomMemory || !roomMemory.localTasks || !roomMemory.localTasks[taskType]) continue;

            const taskList = roomMemory.localTasks[taskType];
            for (const task of taskList) {
                if (task.creepId) continue;
                if (filter && !filter(task)) continue;

                const priority = task.priority || 0;
                if (priority < bestPriority) {
                    bestTask = task;
                    bestPriority = priority;
                    if (priority <= 1) {
                        return bestTask;
                    }
                }
            }
        }

        // 2. 跨房间任务（transport / attack，目前只支持部分类型）
        if (colony.crossRoomTasks) {
            let crossTasks = [];
            if (taskType === Constants.TASK_TYPES.DELIVERY || taskType === Constants.TASK_TYPES.PICKUP) {
                crossTasks = colony.crossRoomTasks.transport || [];
            } else if (taskType === Constants.TASK_TYPES.GUARD) {
                crossTasks = colony.crossRoomTasks.attack || [];
            }
            for (const task of crossTasks) {
                if (task.creepId) continue;
                if (filter && !filter(task)) continue;

                const priority = task.priority || 0;
                if (priority < bestPriority) {
                    bestTask = task;
                    bestPriority = priority;
                    if (priority <= 1) {
                        return bestTask;
                    }
                }
            }
        }

        return bestTask;
    }
};

module.exports = TaskPool;

