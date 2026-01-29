/**
 * 专业采集者角色
 */

const BaseRole = require('./BaseRole');
const MemoryManager = require('../../core/MemoryManager');

function isClassTaskEnabledFor(creep) {
    if (!creep || !creep.memory || !creep.memory.room) return false;
    const roomMemory = MemoryManager.getRoomMemory(creep.memory.room);
    if (!roomMemory || !roomMemory.settings) return false;

    const settings = roomMemory.settings;
    const role = creep.memory.role;

    if (role && settings.roles && settings.roles[role] && settings.roles[role].useClassTasks) {
        return true;
    }

    return !!settings.useClassTasks;
}

class HarvesterPro extends BaseRole {
    acceptTask() {
        // 检查基础条件
        if (this.creep.memory.inTask || this.creep.spawning) {
            return false;
        }

        // 查找采集任务（仅限本房间）
        // 约束：同一采矿点（同一 releaserId）只允许一个 harvesterpro 占用
        const GameCache = require('../../core/GameCache');
        const roomName = this.creep.memory.room;

        const task = this.findAvailableTask(
            'harvestpro',
            roomName,
            (t) => {
                // 优化：使用GameCache缓存的采矿点占用情况，避免循环检查其他creep
                return !GameCache.isHarvestSourceOccupied(roomName, t.releaserId);
            }
        );

        if (task) {
            return this.assignTask(task, roomName);
        }

        return false;
    }

    operate() {
        // 类 Task 模式下，由 HarvestProTask 接管 harvestPro 行为
        if (isClassTaskEnabledFor(this.creep)) {
            return;
        }

        if (this.creep.spawning || !this.creep.memory.inTask) {
            return;
        }

        const task = this.creep.memory.task;
        if (!task) {
            return;
        }

        // 运行时动态获取 TaskBehaviors，确保模块已初始化
        const TaskBehaviors = require('../../task/behaviors/TaskBehaviors');
        if (!TaskBehaviors || !TaskBehaviors.harvestPro) {
            const logger = require('../../core/Logger');
            logger.error(`TaskBehaviors not initialized for ${this.creep.name}`);
            return;
        }

        TaskBehaviors.harvestPro(this.creep, task);
    }

    reviewTask() {
        if (!this.creep.memory.inTask || !this.creep.memory.task) {
            return;
        }

        // 采集任务通常不需要审查，持续采集
        // 可以添加能量满时的处理逻辑
    }
}

module.exports = HarvesterPro;
