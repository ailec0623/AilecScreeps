/**
 * 专业采集者角色
 */

const BaseRole = require('./BaseRole');

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

    /** 执行由 Agent 驱动的 HarvestProTask 接管，角色层不再调用 TaskBehaviors */
    operate() {
        return;
    }

    /** 采集任务无额外审查逻辑 */
    reviewTask() {
        return;
    }
}

module.exports = HarvesterPro;
