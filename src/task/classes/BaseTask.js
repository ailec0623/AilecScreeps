/**
 * BaseTask 抽象基类
 * 包装现有的任务 proto 对象（来自 roomMemory.localTasks / colony.crossRoomTasks）。
 */

// 任务执行结果状态枚举
const TASK_STATUS = {
    OK: 'ok',
    FINISHED: 'finished',
    ABORTED: 'aborted',
    RETRY: 'retry',
};

class BaseTask {
    /**
     * @param {Object} protoTask - 任务 proto（直接来自内存）
     */
    constructor(protoTask) {
        if (!protoTask || !protoTask.type) {
            throw new Error('BaseTask requires a protoTask with type');
        }
        this._proto = Object.assign({}, protoTask);

        this.type = this._proto.type;
        this.priority = this._proto.priority || 0;
        this.releaserId = this._proto.releaserId || null;
        this.sourcePos = this._proto.sourcePosition || null;
        this.targetPos = this._proto.targetPosition || null;
        this.addition = this._proto.addition || null;
        this.crossRoom = !!this._proto.crossRoom;
        this.targetRoom = this._proto.targetRoom || null;
        this.createdAt = this._proto.createdAt || Game.time;
    }

    /**
     * 默认有效性检查：如果绑定目标对象已经不存在，则认为无效。
     * 子类可以覆盖。
     * @param {Creep|Object} _creepOrAgent
     * @returns {boolean}
     */
    isValid(_creepOrAgent) {
        if (this.releaserId) {
            const obj = Game.getObjectById(this.releaserId);
            if (!obj) return false;
        }
        return true;
    }

    /**
     * 公共执行入口（模板方法）。
     * 约定：子类的 work() 必须返回 TASK_STATUS 枚举之一；
     * 如果没有显式返回，则默认为 TASK_STATUS.OK。
     * @param {Creep|Object} creepOrAgent
     * @returns {string} TASK_STATUS
     */
    run(creepOrAgent) {
        if (!this.isValid(creepOrAgent)) {
            return TASK_STATUS.ABORTED;
        }
        const result = this.work(creepOrAgent);
        // 兼容旧实现：若子类仍返回数值（如 OK），视为继续执行
        if (!result) return TASK_STATUS.OK;
        switch (result) {
            case TASK_STATUS.OK:
            case TASK_STATUS.FINISHED:
            case TASK_STATUS.ABORTED:
            case TASK_STATUS.RETRY:
                return result;
            default:
                // 未知返回值，按继续执行处理，避免误杀任务
                return TASK_STATUS.OK;
        }
    }

    /**
     * 具体任务逻辑由子类实现。
     * @abstract
     */
    // eslint-disable-next-line no-unused-vars
    work(_creepOrAgent) {
        throw new Error('BaseTask.work must be implemented by subclass');
    }

    /**
     * 将当前 Task 状态序列化回 proto，对应 creep.memory.task / roomMemory.localTasks[*] 项。
     * 默认只更新少数字段，其余保持原样。
     * @returns {Object}
     */
    toMemory() {
        const proto = Object.assign({}, this._proto);
        proto.type = this.type;
        proto.priority = this.priority;
        proto.releaserId = this.releaserId;
        proto.sourcePosition = this.sourcePos;
        proto.targetPosition = this.targetPos;
        proto.addition = this.addition;
        proto.crossRoom = this.crossRoom;
        proto.targetRoom = this.targetRoom;
        proto.createdAt = this.createdAt;
        return proto;
    }

    /**
     * 简单帮助方法：从 proto 创建实例。
     * 实际上由 TaskFactory 决定具体子类。
     * @param {Object} proto
     */
    static fromMemory(proto) {
        return new this(proto);
    }
}

BaseTask.TASK_STATUS = TASK_STATUS;

module.exports = BaseTask;
module.exports.TASK_STATUS = TASK_STATUS;

