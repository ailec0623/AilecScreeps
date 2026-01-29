/**
 * 工人角色
 * 专注于升级控制器和建造建筑
 * 不接受交付任务和维修任务
 */

const BaseRole = require('./BaseRole');

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

    /** 执行由 Agent 驱动的类 Task 系统接管，角色层不再调用 TaskBehaviors */
    operate() {
        return;
    }

    /** 任务结束由 Task 子类 + Agent 状态驱动，角色层不再做结束判定 */
    reviewTask() {
        return;
    }
}

module.exports = Worker;
