/**
 * 基础角色类
 * 所有角色都继承此类
 */

const MemoryManager = require('../../core/MemoryManager');
const Constants = require('../../config/Constants');
const TaskPool = require('../../task/TaskPool');

class BaseRole {
    /**
     * 构造函数
     * @param {Creep|Object} creepOrAgent - Creep 对象或 Agent 包装
     */
    constructor(creepOrAgent) {
        const creep = creepOrAgent && creepOrAgent.creep ? creepOrAgent.creep : creepOrAgent;
        this.creep = creep;
        this.role = creep.memory.role;
    }

    /**
     * 接受任务（由子类实现）
     * @returns {boolean} 是否成功接受任务
     */
    acceptTask() {
        // 如果已经在任务中或正在生成，跳过
        if (this.creep.memory.inTask || this.creep.spawning) {
            return false;
        }

        // 子类实现具体逻辑
        return false;
    }

    /**
     * 执行任务（由子类实现）
     */
    operate() {
        if (this.creep.spawning || !this.creep.memory.inTask) {
            return;
        }

        // 子类实现具体逻辑
    }

    /**
     * 审查任务（由子类实现）
     */
    reviewTask() {
        if (!this.creep.memory.inTask || !this.creep.memory.task) {
            return;
        }

        // 子类实现具体逻辑
    }

    /**
     * 获取房间内存
     * @param {string} roomName - 房间名称
     * @returns {Object|null}
     */
    getRoomMemory(roomName) {
        return MemoryManager.getRoomMemory(roomName);
    }

    /**
     * 获取殖民地内存
     * @returns {Object}
     */
    getColonyMemory() {
        return MemoryManager.getColonyMemory();
    }

    /**
     * 查找可用任务
     * @param {string} taskType - 任务类型
     * @param {string} roomName - 房间名称（可选，不指定则从多个房间查找）
     * @param {Function} filter - 过滤函数（可选）
     * @returns {Object|null} 任务对象
     */
    findAvailableTask(taskType, roomName = null, filter = null) {
        if (roomName) {
            return TaskPool.findBestLocalTask(roomName, taskType, filter);
        }
        return TaskPool.findBestGlobalTask(taskType, filter);
    }

    /**
     * 接受任务
     * @param {Object} task - 任务对象
     * @param {string} roomName - 任务所在房间
     * @param {boolean} _isRetry - 内部重试标记，避免无限递归
     * @returns {boolean} 是否成功
     */
    assignTask(task, roomName = null, _isRetry = false) {
        const logger = require('../../core/Logger');
        
        if (!task) {
            logger.warn(`assignTask: task is null for creep ${this.creep.name}`);
            return false;
        }

        if (task.creepId) {
            logger.warn(`assignTask: task ${task.releaserId} already assigned to creep ${task.creepId}`);
            return false;
        }

        // 确定任务所在房间
        const targetRoom = roomName || (task.targetPosition && task.targetPosition.roomName) || (task.sourcePosition && task.sourcePosition.roomName) || this.creep.memory.room;
        
        // 如果是跨房间任务
        if (task.crossRoom) {
            // 从殖民地任务中分配
            const colony = this.getColonyMemory();
            const taskList = task.type === Constants.TASK_TYPES.DELIVERY || task.type === Constants.TASK_TYPES.PICKUP
                ? colony.crossRoomTasks.transport
                : task.type === Constants.TASK_TYPES.GUARD
                ? colony.crossRoomTasks.attack
                : colony.crossRoomTasks.expand;

            // 使用 releaserId 和 createdAt 来匹配任务（避免对象引用问题）
            const taskIndex = taskList.findIndex(t => 
                !t.creepId && 
                t.releaserId === task.releaserId && 
                t.type === task.type &&
                t.createdAt === task.createdAt
            );
            if (taskIndex >= 0) {
                const actualTask = taskList[taskIndex];
                actualTask.creepId = this.creep.id;
                this.creep.memory.task = actualTask;
                this.creep.memory.inTask = true;
                return true;
            }
        } else {
            // 本地任务
            const roomMemory = this.getRoomMemory(targetRoom);
            if (!roomMemory || !roomMemory.localTasks || !roomMemory.localTasks[task.type]) {
                return false;
            }

            const taskList = roomMemory.localTasks[task.type];
            
            // 首先尝试精确匹配（releaserId + createdAt）
            let taskIndex = taskList.findIndex(t => 
                !t.creepId && 
                t.releaserId === task.releaserId && 
                t.type === task.type &&
                t.createdAt === task.createdAt
            );
            
            // 如果精确匹配失败，尝试只匹配 releaserId
            if (taskIndex < 0) {
                taskIndex = taskList.findIndex(t => 
                    !t.creepId && 
                    t.releaserId === task.releaserId && 
                    t.type === task.type
                );
            }
            
            if (taskIndex >= 0) {
                const actualTask = taskList[taskIndex];
                actualTask.creepId = this.creep.id;
                this.creep.memory.task = actualTask;
                this.creep.memory.inTask = true;
                return true;
            }

            // 如果当前任务已经被别人抢走了，并且这是第一次尝试分配，
            // 再尝试寻找同类型的“下一个可用任务”
            if (!_isRetry) {
                const nextTask = this.findAvailableTask(task.type, targetRoom);
                if (nextTask && (nextTask.releaserId !== task.releaserId || nextTask.createdAt !== task.createdAt)) {
                    return this.assignTask(nextTask, targetRoom, true);
                }
            }
        }

        return false;
    }

    /**
     * 完成任务
     * @param {Object} task - 任务对象
     */
    completeTask(task) {
        if (!task) return;

        this.creep.memory.inTask = false;
        this.creep.memory.task = null;

        // 从任务列表中移除
        if (task.crossRoom) {
            const colony = this.getColonyMemory();
            const taskList = task.type === Constants.TASK_TYPES.DELIVERY || task.type === Constants.TASK_TYPES.PICKUP
                ? colony.crossRoomTasks.transport
                : task.type === Constants.TASK_TYPES.GUARD
                ? colony.crossRoomTasks.attack
                : colony.crossRoomTasks.expand;

            const index = taskList.findIndex(t => t.creepId === this.creep.id);
            if (index >= 0) {
                taskList.splice(index, 1);
            }
        } else {
            const targetRoom = (task.targetPosition && task.targetPosition.roomName) || (task.sourcePosition && task.sourcePosition.roomName) || this.creep.memory.room;
            const roomMemory = this.getRoomMemory(targetRoom);
            if (roomMemory && roomMemory.localTasks && roomMemory.localTasks[task.type]) {
                const index = roomMemory.localTasks[task.type].findIndex(t => t.creepId === this.creep.id);
                if (index >= 0) {
                    roomMemory.localTasks[task.type].splice(index, 1);
                }
            }
        }
    }

    /**
     * 移动到目标位置（支持跨房间）
     * @param {RoomPosition|Object} target - 目标位置
     * @param {Object} options - 移动选项
     * @returns {number} 移动结果代码
     */
    moveTo(target, options = {}) {
        if (!target) return ERR_INVALID_TARGET;

        let targetPos;
        if (target instanceof RoomPosition) {
            targetPos = target;
        } else if (target.x !== undefined && target.y !== undefined) {
            const roomName = target.roomName || this.creep.room.name;
            targetPos = new RoomPosition(target.x, target.y, roomName);
        } else {
            return ERR_INVALID_TARGET;
        }

        // 如果不在同一房间，先移动到目标房间
        if (this.creep.room.name !== targetPos.roomName) {
            const exitDir = this.creep.room.findExitTo(targetPos.roomName);
            if (exitDir === ERR_NO_PATH) {
                return ERR_NO_PATH;
            }
            const exit = this.creep.pos.findClosestByRange(exitDir);
            if (exit) {
                return this.creep.moveTo(exit, options);
            }
        }

        return this.creep.moveTo(targetPos, options);
    }
}

module.exports = BaseRole;
