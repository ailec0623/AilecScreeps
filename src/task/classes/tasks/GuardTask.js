const BaseTask = require('../BaseTask');
const TaskBehaviors = require('../../behaviors/TaskBehaviors');

/**
 * 守卫任务（guard）
 */
class GuardTask extends BaseTask {
    work(creepOrAgent) {
        TaskBehaviors.guard(creepOrAgent, this.toMemory());
        return OK;
    }
}

module.exports = GuardTask;

