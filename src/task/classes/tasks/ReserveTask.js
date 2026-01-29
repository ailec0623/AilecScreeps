const BaseTask = require('../BaseTask');
const TaskBehaviors = require('../../behaviors/TaskBehaviors');

/**
 * 预订任务（reserve）
 */
class ReserveTask extends BaseTask {
    work(creepOrAgent) {
        TaskBehaviors.reserve(creepOrAgent, this.toMemory());
        return OK;
    }
}

module.exports = ReserveTask;

