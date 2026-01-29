const BaseTask = require('../BaseTask');
const TaskBehaviors = require('../../behaviors/TaskBehaviors');

const { TASK_STATUS } = BaseTask;

function unwrapCreep(creepOrAgent) {
    return creepOrAgent && creepOrAgent.creep ? creepOrAgent.creep : creepOrAgent;
}

/**
 * 建造任务（build）
 * 结束条件来源于 Worker.reviewTask：
 * - creep 存储为空 => FINISHED
 * - 目标不存在 => ABORTED
 */
class BuildTask extends BaseTask {
    isValid(_creepOrAgent) {
        if (!super.isValid(_creepOrAgent)) return false;

        if (!this.releaserId) return false;
        const target = Game.getObjectById(this.releaserId);
        if (!target) return false;

        return true;
    }

    work(creepOrAgent) {
        const creep = unwrapCreep(creepOrAgent);

        TaskBehaviors.build(creepOrAgent, this.toMemory());

        if (creep.store.getUsedCapacity() === 0) {
            return TASK_STATUS.FINISHED;
        }

        const target = Game.getObjectById(this.releaserId);
        if (!target) {
            return TASK_STATUS.ABORTED;
        }

        return TASK_STATUS.OK;
    }
}

module.exports = BuildTask;

