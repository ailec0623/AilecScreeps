const BaseTask = require('../BaseTask');
const TaskBehaviors = require('../../behaviors/TaskBehaviors');

/**
 * 修理任务（repair）
 */
class RepairTask extends BaseTask {
    work(creepOrAgent) {
        TaskBehaviors.repair(creepOrAgent, this.toMemory());
        return OK;
    }
}

module.exports = RepairTask;

