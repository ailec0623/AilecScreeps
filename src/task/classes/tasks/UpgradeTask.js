const BaseTask = require('../BaseTask');
const TaskBehaviors = require('../../behaviors/TaskBehaviors');

const { TASK_STATUS } = BaseTask;

function unwrapCreep(creepOrAgent) {
    return creepOrAgent && creepOrAgent.creep ? creepOrAgent.creep : creepOrAgent;
}

/**
 * 升级任务（upgrade）
 * 结束条件来源于 Worker.reviewTask：
 * - creep 存储为空 => FINISHED
 */
class UpgradeTask extends BaseTask {
    isValid(_creepOrAgent) {
        if (!super.isValid(_creepOrAgent)) return false;

        if (!this.releaserId) return false;
        const target = Game.getObjectById(this.releaserId);
        if (!target) return false;

        return true;
    }

    work(creepOrAgent) {
        const creep = unwrapCreep(creepOrAgent);

        TaskBehaviors.upgrade(creepOrAgent, this.toMemory());

        if (creep.store.getUsedCapacity() === 0) {
            return TASK_STATUS.FINISHED;
        }

        return TASK_STATUS.OK;
    }
}

module.exports = UpgradeTask;

