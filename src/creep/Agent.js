/**
 * Agent 包装类
 * 对 Creep 做一层轻量封装，便于后续引入更复杂的任务 / 移动 / Overlord 系统。
 * 第一阶段只做「包一层」，不改变任何行为。
 */

class Agent {
    /**
     * @param {Creep} creep
     */
    constructor(creep) {
        if (!creep) {
            throw new Error('Agent constructor requires a valid creep');
        }

        this.name = creep.name;
        this.creep = creep;
    }

    /**
     * 当前 tick 刷新内部 creep 引用。
     * 如果 creep 已死亡，返回 false，交由外部 Registry 清理引用。
     * @returns {boolean}
     */
    refresh() {
        const creep = Game.creeps[this.name];
        if (!creep) {
            this.creep = null;
            return false;
        }
        this.creep = creep;
        return true;
    }

    // 只读属性封装，统一从 this.creep 读取，避免外部直接依赖 Creep

    get room() {
        return this.creep && this.creep.room;
    }

    get pos() {
        return this.creep && this.creep.pos;
    }

    get memory() {
        return this.creep && this.creep.memory;
    }

    get role() {
        return this.creep && this.creep.memory && this.creep.memory.role;
    }

    get ticksToLive() {
        return this.creep && this.creep.ticksToLive;
    }

    get spawning() {
        return this.creep && this.creep.spawning;
    }

    /**
     * 是否处于「空闲」状态：没有任务或任务无效。
     * 目前直接基于现有内存字段判断，后续可以挂接到 Task 类系统。
     */
    get isIdle() {
        if (!this.creep || !this.creep.memory) return true;
        return !this.creep.memory.inTask || !this.creep.memory.task;
    }

    /**
     * 是否有任务（不判断任务是否仍然合理）。
     */
    get hasTask() {
        return !!(this.creep && this.creep.memory && this.creep.memory.task);
    }

    /**
     * 任务 Getter
     * 第一阶段直接代理到 creep.memory.task，作为未来 Task 类系统的挂接点。
     */
    get task() {
        if (!this.creep || !this.creep.memory) return null;
        return this.creep.memory.task || null;
    }

    /**
     * 任务 Setter
     * 目前只做简单的内存赋值，未来可以在这里把 Task 实例序列化为 ProtoTask。
     * @param {any} value
     */
    set task(value) {
        if (!this.creep || !this.creep.memory) return;
        this.creep.memory.task = value || null;
        // 同时根据任务是否存在粗略更新 inTask 标记，保持与老逻辑一致
        if (typeof this.creep.memory.inTask !== 'undefined') {
            this.creep.memory.inTask = !!value;
        }
    }

    /**
     * 本 tick 执行 creep 行为。
     * 保持与旧逻辑一致：acceptTask -> operate -> reviewTask。
     */
    run() {
        const creep = this.creep;
        if (!creep) return;

        // 与旧实现保持完全一致，避免引入行为差异
        if (typeof creep.acceptTask === 'function') {
            creep.acceptTask();
        }
        if (typeof creep.operate === 'function') {
            creep.operate();
        }
        if (typeof creep.reviewTask === 'function') {
            creep.reviewTask();
        }
    }

    // 一些常用动作的薄包装，便于以后在 Agent 层统一增强行为

    moveTo(target, opts) {
        const creep = this.creep;
        if (!creep) return ERR_INVALID_TARGET;
        return creep.moveTo(target, opts);
    }

    harvest(target) {
        const creep = this.creep;
        if (!creep) return ERR_INVALID_TARGET;
        return creep.harvest(target);
    }

    build(target) {
        const creep = this.creep;
        if (!creep) return ERR_INVALID_TARGET;
        return creep.build(target);
    }

    repair(target) {
        const creep = this.creep;
        if (!creep) return ERR_INVALID_TARGET;
        return creep.repair(target);
    }

    transfer(target, resourceType, amount) {
        const creep = this.creep;
        if (!creep) return ERR_INVALID_TARGET;
        return creep.transfer(target, resourceType, amount);
    }
}

module.exports = Agent;

