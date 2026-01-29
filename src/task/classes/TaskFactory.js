/**
 * TaskFactory
 * 根据 protoTask.type 创建对应的 Task 实例。
 */

const BaseTask = require('./BaseTask');

// 具体任务类稍后按需 require，避免循环依赖
function getTaskClassByType(type) {
    switch (type) {
        case 'harvestpro':
            return require('./tasks/HarvestProTask');
        case 'pickup':
            return require('./tasks/PickupTask');
        case 'delivery':
            return require('./tasks/DeliveryTask');
        case 'getenergy':
            return require('./tasks/GetEnergyTask');
        case 'upgrade':
            return require('./tasks/UpgradeTask');
        case 'repair':
            return require('./tasks/RepairTask');
        case 'build':
            return require('./tasks/BuildTask');
        case 'reserve':
            return require('./tasks/ReserveTask');
        case 'guard':
            return require('./tasks/GuardTask');
        default:
            return null;
    }
}

class InvalidTask extends BaseTask {
    work() {
        return BaseTask.TASK_STATUS.ABORTED;
    }

    isValid() {
        return false;
    }
}

const TaskFactory = {
    /**
     * 从内存 proto 创建 Task 实例。
     * @param {Object} protoTask
     * @returns {BaseTask}
     */
    createFromMemory(protoTask) {
        if (!protoTask || !protoTask.type) {
            return new InvalidTask({ type: 'invalid' });
        }
        const TaskClass = getTaskClassByType(protoTask.type) || InvalidTask;
        try {
            return new TaskClass(protoTask);
        } catch (e) {
            // 避免因为单个任务构造失败导致整个 tick 崩溃
            console.log(`[TaskFactory] failed to create task for type=${protoTask.type}: ${e && e.stack || e}`);
            return new InvalidTask(protoTask);
        }
    }
};

module.exports = TaskFactory;

