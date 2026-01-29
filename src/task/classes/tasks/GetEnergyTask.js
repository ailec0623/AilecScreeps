const BaseTask = require('../BaseTask');
const TaskBehaviors = require('../../behaviors/TaskBehaviors');

const { TASK_STATUS } = BaseTask;

function unwrapCreep(creepOrAgent) {
    return creepOrAgent && creepOrAgent.creep ? creepOrAgent.creep : creepOrAgent;
}

/**
 * 获取能量任务（getenergy）
 * 结束条件来源于 Carrier/Worker.reviewTask：
 * - creep.store 有任意能量 => FINISHED
 * - 目标不存在或能量耗尽 => ABORTED
 */
class GetEnergyTask extends BaseTask {
    isValid(_creepOrAgent) {
        if (!super.isValid(_creepOrAgent)) return false;

        if (!this.releaserId) return false;
        const target = Game.getObjectById(this.releaserId);
        if (!target || !target.store) return false;

        if (target.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
            return false;
        }

        return true;
    }

    work(creepOrAgent) {
        const creep = unwrapCreep(creepOrAgent);

        TaskBehaviors.getenergy(creepOrAgent, this.toMemory());

        if (creep.store.getUsedCapacity() > 0) {
            return TASK_STATUS.FINISHED;
        }

        const target = Game.getObjectById(this.releaserId);
        if (!target || !target.store || target.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
            return TASK_STATUS.ABORTED;
        }

        return TASK_STATUS.OK;
    }
}

module.exports = GetEnergyTask;

