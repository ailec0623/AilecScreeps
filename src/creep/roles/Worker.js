/**
 * 工人角色
 * 专注于升级控制器和建造建筑
 * 不接受交付任务和维修任务
 */

const BaseRole = require('./BaseRole');
const logger = require('../../core/Logger');

class Worker extends BaseRole {
    acceptTask() {
        // 检查基础条件
        if (this.creep.memory.inTask || this.creep.spawning) {
            return false;
        }

        // 如果能量为空，查找获取能量任务或拾取任务
        if (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            // 优先查找获取能量任务
            let task = this.findAvailableTask('getenergy', this.creep.memory.room);
            
            // 如果找不到，查找拾取任务
            if (!task) {
                task = this.findAvailableTask('pickup', this.creep.memory.room);
            }
            
            if (task) {
                return this.assignTask(task, this.creep.memory.room);
            }
            return false;
        } else {
            // 如果能量不为空，按优先级查找工作任务（仅限本房间）
            // Worker 专注于升级控制器和建造建筑，不接受维修和交付任务
            
            // 1. 建造任务（优先，仅限本房间）
            let task = this.findAvailableTask('build', this.creep.memory.room);
            
            // 2. 升级任务（如果没有建造任务，仅限本房间）
            if (!task) {
                task = this.findAvailableTask('upgrade', this.creep.memory.room);
            }

            if (task) {
                return this.assignTask(task, this.creep.memory.room);
            }
        }

        return false;
    }

    operate() {
        if (this.creep.spawning || !this.creep.memory.inTask) {
            return;
        }

        const task = this.creep.memory.task;
        if (!task) {
            return;
        }

        // 运行时动态获取 TaskBehaviors，确保模块已初始化
        const TaskBehaviors = require('../../task/behaviors/TaskBehaviors');
        if (!TaskBehaviors) {
            logger.error(`TaskBehaviors not initialized for ${this.creep.name}`);
            return;
        }

        switch (task.type) {
            case 'build':
                if (TaskBehaviors.build) {
                    TaskBehaviors.build(this.creep, task);
                } else {
                    logger.error(`TaskBehaviors.build not available for ${this.creep.name}`);
                }
                break;
            case 'upgrade':
                if (TaskBehaviors.upgrade) {
                    TaskBehaviors.upgrade(this.creep, task);
                } else {
                    logger.error(`TaskBehaviors.upgrade not available for ${this.creep.name}`);
                }
                break;
            case 'getenergy':
                if (TaskBehaviors.getenergy) {
                    TaskBehaviors.getenergy(this.creep, task);
                } else {
                    logger.error(`TaskBehaviors.getenergy not available for ${this.creep.name}`);
                }
                break;
            case 'pickup':
                if (TaskBehaviors.pickUp) {
                    TaskBehaviors.pickUp(this.creep, task);
                } else {
                    logger.error(`TaskBehaviors.pickUp not available for ${this.creep.name}`);
                }
                break;
            default:
                logger.warn(`Worker ${this.creep.name} received unexpected task type: ${task.type}`);
                break;
        }
    }

    reviewTask() {
        if (!this.creep.memory.inTask || !this.creep.memory.task) {
            return;
        }

        const task = this.creep.memory.task;

        switch (task.type) {
            case 'build':
                if (this.creep.store.getUsedCapacity() === 0) {
                    this.completeTask(task);
                } else {
                    const target = Game.getObjectById(task.releaserId);
                    if (!target) {
                        this.completeTask(task);
                    }
                }
                break;

            case 'upgrade':
                if (this.creep.store.getUsedCapacity() === 0) {
                    this.completeTask(task);
                }
                break;

            case 'getenergy':
            case 'pickup':
                if (this.creep.store.getUsedCapacity() > 0) {
                    this.completeTask(task);
                }
                break;
        }
    }
}

module.exports = Worker;
