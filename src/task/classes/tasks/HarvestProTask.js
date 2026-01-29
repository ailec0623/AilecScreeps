const BaseTask = require('../BaseTask');
const TaskBehaviors = require('../../behaviors/TaskBehaviors');

/**
 * 采集任务（harvestpro）
 * 目前直接委托给 TaskBehaviors.harvestPro。
 */
class HarvestProTask extends BaseTask {
    work(creepOrAgent) {
        TaskBehaviors.harvestPro(creepOrAgent, this.toMemory());
        return OK;
    }
}

module.exports = HarvestProTask;

