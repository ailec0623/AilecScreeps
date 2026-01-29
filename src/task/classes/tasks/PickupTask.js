const BaseTask = require('../BaseTask');
const TaskBehaviors = require('../../behaviors/TaskBehaviors');

const { TASK_STATUS } = BaseTask;

function unwrapCreep(creepOrAgent) {
    return creepOrAgent && creepOrAgent.creep ? creepOrAgent.creep : creepOrAgent;
}

/**
 * 拾取任务（pickup）
 * 结束条件来源于 Carrier/Worker.reviewTask：
 * - creep.store 有资源 => FINISHED
 * - 目标不存在或能量过少 => ABORTED
 */
class PickupTask extends BaseTask {
    isValid(_creepOrAgent) {
        if (!super.isValid(_creepOrAgent)) return false;

        if (!this.releaserId) return false;
        const target = Game.getObjectById(this.releaserId);
        if (!target) return false;

        // 如果是带 store 的结构且能量极少，则视为无效（对齐 Carrier.reviewTask 的 “source low energy” 行为）
        if (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) < 10) {
            return false;
        }

        return true;
    }

    work(creepOrAgent) {
        const creep = unwrapCreep(creepOrAgent);

        TaskBehaviors.pickUp(creepOrAgent, this.toMemory());

        // 若已经拾取到任意资源，则认为任务完成
        if (creep.store.getUsedCapacity() > 0) {
            return TASK_STATUS.FINISHED;
        }

        // 若目标已经消失或不再可用，则放弃任务
        const target = Game.getObjectById(this.releaserId);
        if (!target) {
            return TASK_STATUS.ABORTED;
        }

        if (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) < 10) {
            return TASK_STATUS.ABORTED;
        }

        return TASK_STATUS.OK;
    }
}

module.exports = PickupTask;

