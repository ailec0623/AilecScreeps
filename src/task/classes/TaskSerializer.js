const TaskFactory = require('./TaskFactory');

function unwrapCreep(creepOrAgent) {
    return creepOrAgent && creepOrAgent.creep ? creepOrAgent.creep : creepOrAgent;
}

/**
 * TaskSerializer
 * 负责在 Task 实例与 creep.memory.task proto 之间进行转换。
 */
const TaskSerializer = {
    /**
     * 从 creep 内存中加载 Task 实例
     * @param {Creep|Object} creepOrAgent
     */
    loadFromCreep(creepOrAgent) {
        const creep = unwrapCreep(creepOrAgent);
        if (!creep || !creep.memory || !creep.memory.task) return null;
        return TaskFactory.createFromMemory(creep.memory.task);
    },

    /**
     * 将 Task 实例保存回 creep 内存；若 taskInstance 为 null，则清空任务
     * @param {Creep|Object} creepOrAgent
     * @param {Object|null} taskInstance
     */
    saveToCreep(creepOrAgent, taskInstance) {
        const creep = unwrapCreep(creepOrAgent);
        if (!creep) return;
        if (!creep.memory) creep.memory = {};

        if (!taskInstance) {
            creep.memory.task = null;
            creep.memory.inTask = false;
            return;
        }

        const proto = taskInstance.toMemory();
        creep.memory.task = proto;
        creep.memory.inTask = true;
    }
};

module.exports = TaskSerializer;

