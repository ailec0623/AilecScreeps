const BaseTask = require('../BaseTask');
const TaskBehaviors = require('../../behaviors/TaskBehaviors');

const { TASK_STATUS } = BaseTask;

function unwrapCreep(creepOrAgent) {
    return creepOrAgent && creepOrAgent.creep ? creepOrAgent.creep : creepOrAgent;
}

/**
 * 递送任务（delivery）
 * 结束条件来源于 Carrier.reviewTask：
 * - creep 能量为空 => FINISHED
 * - 目标不存在 / 已满 / 剩余空间极少 => FINISHED/ABORTED
 */
class DeliveryTask extends BaseTask {
    isValid(_creepOrAgent) {
        if (!super.isValid(_creepOrAgent)) return false;

        if (!this.releaserId) return false;
        const target = Game.getObjectById(this.releaserId);
        if (!target || !target.store) return false;

        const freeCapacity = target.store.getFreeCapacity(RESOURCE_ENERGY);
        if (freeCapacity === 0) return false;

        return true;
    }

    work(creepOrAgent) {
        const creep = unwrapCreep(creepOrAgent);

        TaskBehaviors.delivery(creepOrAgent, this.toMemory());

        const used = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        if (used === 0) {
            return TASK_STATUS.FINISHED;
        }

        const target = Game.getObjectById(this.releaserId);
        if (!target || !target.store) {
            return TASK_STATUS.ABORTED;
        }

        const freeCapacity = target.store.getFreeCapacity(RESOURCE_ENERGY);
        if (freeCapacity === 0) {
            return TASK_STATUS.FINISHED;
        }

        if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) {
            if (freeCapacity < 50) {
                return TASK_STATUS.FINISHED;
            }
        } else if (target.structureType === STRUCTURE_TOWER) {
            if (freeCapacity < 200) {
                return TASK_STATUS.FINISHED;
            }
        } else {
            if (freeCapacity < 2) {
                return TASK_STATUS.FINISHED;
            }
        }

        return TASK_STATUS.OK;
    }
}

module.exports = DeliveryTask;

