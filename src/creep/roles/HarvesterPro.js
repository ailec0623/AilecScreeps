/**
 * 专业采集者角色
 */

const BaseRole = require('./BaseRole');
const TaskBehaviors = require('../../task/behaviors/TaskBehaviors');

class HarvesterPro extends BaseRole {
    acceptTask() {
        // 检查基础条件
        if (this.creep.memory.inTask || this.creep.spawning) {
            return false;
        }

        // 查找采集任务（支持跨房间）
        const task = this.findAvailableTask('harvestpro', null);
        
        if (task) {
            const roomName = (task.sourcePosition && task.sourcePosition.roomName) || this.creep.memory.room;
            return this.assignTask(task, roomName);
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

        TaskBehaviors.harvestPro(this.creep, task);
    }

    reviewTask() {
        if (!this.creep.memory.inTask || !this.creep.memory.task) {
            return;
        }

        // 采集任务通常不需要审查，持续采集
        // 可以添加能量满时的处理逻辑
    }
}

module.exports = HarvesterPro;
