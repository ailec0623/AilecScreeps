/**
 * Agent 包装类
 * 对 Creep 做一层轻量封装，便于后续引入更复杂的任务 / 移动 / Overlord 系统。
 */

const TaskSerializer = require('../task/classes/TaskSerializer');
const BaseTask = require('../task/classes/BaseTask');
const MemoryManager = require('../core/MemoryManager');

// 任务执行结果状态（与 BaseTask 保持一致）
const TASK_STATUS = BaseTask.TASK_STATUS;

// 当前已接入类 Task 系统的角色
const CLASS_TASK_ROLES = ['harvesterpro', 'carrier', 'worker'];

/**
 * 是否对指定 creep 启用类 Task 系统（按房间 / 角色灰度配置）。
 * 配置来源：Memory.colony_v2.colony.rooms[room].settings.{useClassTasks, roles[role].useClassTasks}
 * 默认：仅对 CLASS_TASK_ROLES 支持类 Task 模式，其它角色保持旧逻辑。
 * @param {Creep} creep
 * @returns {boolean}
 */
function isClassTaskEnabledFor(creep) {
    if (!creep || !creep.memory || !creep.memory.room) return false;

    const role = creep.memory.role;
    if (CLASS_TASK_ROLES.indexOf(role) === -1) return false;

    const roomMemory = MemoryManager.getRoomMemory(creep.memory.room);
    if (!roomMemory || !roomMemory.settings) return false;

    const settings = roomMemory.settings;

    // 角色级覆盖优先
    if (settings.roles && settings.roles[role] && settings.roles[role].useClassTasks) {
        return true;
    }

    // 房间级开关
    return !!settings.useClassTasks;
}

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
     * 当未启用类 Task 系统时，直接返回 proto；启用后返回 Task 实例。
     */
    get task() {
        if (!this.creep || !this.creep.memory) return null;
        if (!isClassTaskEnabledFor(this.creep)) {
            return this.creep.memory.task || null;
        }
        return TaskSerializer.loadFromCreep(this);
    }

    /**
     * 任务 Setter
     * 允许传入 Task 实例或 proto，对 creep.memory.task 进行集中封装。
     * @param {any} value
     */
    set task(value) {
        if (!this.creep || !this.creep.memory) return;

        const useClassTasks = isClassTaskEnabledFor(this.creep);
        if (!useClassTasks) {
            this.creep.memory.task = value || null;
            if (typeof this.creep.memory.inTask !== 'undefined') {
                this.creep.memory.inTask = !!value;
            }
            return;
        }

        // 启用类 Task 系统时
        if (!value) {
            TaskSerializer.saveToCreep(this, null);
        } else if (typeof value.run === 'function' && typeof value.toMemory === 'function') {
            // 看起来像 Task 实例
            TaskSerializer.saveToCreep(this, value);
        } else {
            // 看起来是 proto，对其进行一次包装后再保存
            this.creep.memory.task = value;
            this.creep.memory.inTask = true;
        }
    }

    /**
     * 本 tick 执行 creep 行为。
     * 单一路径：acceptTask -> 若有 Task 实例则 task.run()，否则 operate + reviewTask。
     */
    run() {
        const creep = this.creep;
        if (!creep) return;

        if (typeof creep.acceptTask === 'function') {
            creep.acceptTask();
        }

        const task = this.task;
        if (!task) {
            // Carrier 无任务时需执行 checkIfExceedsRequirement（超额自杀）
            if (creep.memory.role === 'carrier' && typeof creep.reviewTask === 'function') {
                creep.reviewTask();
            }
            return;
        }

        // Task 类实例：由 BaseTask.run 驱动，按状态完成/清理
        if (typeof task.run === 'function') {
            let status = TASK_STATUS.OK;
            try {
                status = task.run(this);
            } catch (e) {
                console.log(`[Agent] error running task for ${this.name}: ${e && e.stack || e}`);
                status = TASK_STATUS.ABORTED;
            }
            if (status === TASK_STATUS.FINISHED || status === TASK_STATUS.ABORTED) {
                this._completeTaskViaRole(task);
            }
            return;
        }

        // Proto / 未接入类 Task 的角色：沿用 operate + reviewTask
        if (typeof creep.operate === 'function') creep.operate();
        if (typeof creep.reviewTask === 'function') creep.reviewTask();
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

    /**
     * 辅助方法：根据 creep 的角色创建 Role 实例，并调用其 completeTask，复用 BaseRole.completeTask 逻辑。
     * @param {Object} taskInstance - Task 实例或任务 proto
     * @private
     */
    _completeTaskViaRole(taskInstance) {
        const creep = this.creep;
        if (!creep || !creep.memory || !creep.memory.role) return;

        const roleName = creep.memory.role;
        let RoleClass = null;

        try {
            switch (roleName) {
                case 'harvesterpro':
                    RoleClass = require('./roles/HarvesterPro');
                    break;
                case 'carrier':
                    RoleClass = require('./roles/Carrier');
                    break;
                case 'worker':
                    RoleClass = require('./roles/Worker');
                    break;
                default:
                    // 其他角色暂不接入类 Task 系统完成流程
                    return;
            }
        } catch (e) {
            console.log(`[Agent] failed to load role class for ${roleName}: ${e && e.stack || e}`);
            return;
        }

        const roleInstance = new RoleClass(this);
        const proto = typeof taskInstance.toMemory === 'function'
            ? taskInstance.toMemory()
            : taskInstance;

        try {
            roleInstance.completeTask(proto);
        } catch (e) {
            console.log(`[Agent] error completing task for ${this.name}: ${e && e.stack || e}`);
        }
    }
}

module.exports = Agent;
