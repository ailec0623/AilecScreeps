/**
 * 任务发布器
 * 支持本地任务和跨房间任务
 */

const logger = require('../core/Logger');
const MemoryManager = require('../core/MemoryManager');
const Constants = require('../config/Constants');

class TaskReleaser {
    /**
     * 发布任务
     * @param {Room|string} room - 房间对象或房间名称
     * @param {string} taskType - 任务类型
     * @param {RoomPosition|Object} sourcePosition - 源位置
     * @param {RoomPosition|Object} targetPosition - 目标位置
     * @param {string} releaserId - 发布者 ID
     * @param {number} priority - 优先级
     * @param {Object} addition - 额外信息
     * @param {boolean} crossRoom - 是否为跨房间任务
     * @param {string} targetRoom - 目标房间（跨房间任务时使用）
     */
    static releaseTask(room, taskType, sourcePosition, targetPosition, releaserId, priority, addition = null, crossRoom = false, targetRoom = null) {
        const roomName = typeof room === 'string' ? room : room.name;
        const roomMemory = MemoryManager.getRoomMemory(roomName);

        if (!roomMemory) {
            logger.warn(`Cannot release task: room ${roomName} not found`);
            return false;
        }

        // 构建位置对象
        const sourcePos = this.normalizePosition(sourcePosition);
        const targetPos = this.normalizePosition(targetPosition);

        const task = {
            type: taskType,
            creepId: null,
            sourcePosition: sourcePos,
            targetPosition: targetPos,
            priority: priority,
            releaserId: releaserId,
            addition: addition,
            crossRoom: crossRoom,
            targetRoom: targetRoom || roomName,
            createdAt: Game.time
        };

        // 如果是跨房间任务，添加到殖民地任务队列
        if (crossRoom && targetRoom && targetRoom !== roomName) {
            const colony = MemoryManager.getColonyMemory();
            if (!colony.crossRoomTasks) {
                colony.crossRoomTasks = {
                    transport: [],
                    attack: [],
                    expand: []
                };
            }

            // 根据任务类型分类
            if (taskType === Constants.TASK_TYPES.DELIVERY || taskType === Constants.TASK_TYPES.PICKUP) {
                colony.crossRoomTasks.transport.push(task);
            } else if (taskType === Constants.TASK_TYPES.GUARD) {
                colony.crossRoomTasks.attack.push(task);
            } else {
                colony.crossRoomTasks.expand.push(task);
            }

            logger.debug(`Cross-room task released: ${taskType} from ${roomName} to ${targetRoom}`);
        } else {
            // 本地任务
            if (!roomMemory.localTasks[taskType]) {
                roomMemory.localTasks[taskType] = [];
            }
            roomMemory.localTasks[taskType].push(task);
            logger.debug(`Local task released: ${taskType} in ${roomName}`);
        }

        return true;
    }

    /**
     * 标准化位置对象
     * @param {RoomPosition|Object} position
     * @returns {Object}
     */
    static normalizePosition(position) {
        if (!position) {
            return { x: 0, y: 0, roomName: '' };
        }

        if (position.x !== undefined && position.y !== undefined) {
            return {
                x: position.x,
                y: position.y,
                roomName: position.roomName || ''
            };
        }

        return { x: 0, y: 0, roomName: '' };
    }
}

module.exports = TaskReleaser;
