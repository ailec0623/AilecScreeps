/**
 * Creep 小组管理器（预留接口）
 * 用于未来实现 Creep 小组协作功能
 */

const logger = require('../core/Logger');
const MemoryManager = require('../core/MemoryManager');

class CreepGroup {
    /**
     * 创建小组
     * @param {string} groupId - 小组 ID
     * @param {Array<string>} creepIds - Creep ID 列表
     * @param {string} taskType - 任务类型
     * @param {Object} taskData - 任务数据
     */
    static createGroup(groupId, creepIds, taskType, taskData) {
        const colony = MemoryManager.getColonyMemory();
        if (!colony.groups) {
            colony.groups = {};
        }

        colony.groups[groupId] = {
            id: groupId,
            creepIds: creepIds,
            taskType: taskType,
            taskData: taskData,
            status: 'forming', // forming, active, completed, failed
            createdAt: Game.time
        };

        logger.debug(`Creep group created: ${groupId} with ${creepIds.length} creeps`);
    }

    /**
     * 获取小组
     * @param {string} groupId - 小组 ID
     * @returns {Object|null}
     */
    static getGroup(groupId) {
        const colony = MemoryManager.getColonyMemory();
        return (colony.groups && colony.groups[groupId]) || null;
    }

    /**
     * 更新小组状态
     * @param {string} groupId - 小组 ID
     * @param {string} status - 新状态
     */
    static updateGroupStatus(groupId, status) {
        const group = this.getGroup(groupId);
        if (group) {
            group.status = status;
        }
    }

    /**
     * 解散小组
     * @param {string} groupId - 小组 ID
     */
    static disbandGroup(groupId) {
        const colony = MemoryManager.getColonyMemory();
        if (colony.groups && colony.groups[groupId]) {
            delete colony.groups[groupId];
            logger.debug(`Creep group disbanded: ${groupId}`);
        }
    }

    /**
     * 处理小组任务
     * 当前阶段仅预留接口，不实现具体逻辑
     */
    static processGroups() {
        const colony = MemoryManager.getColonyMemory();
        if (!colony.groups) {
            return;
        }

        // TODO: 实现小组协作逻辑
        // 当前阶段仅预留接口
        for (const groupId in colony.groups) {
            const group = colony.groups[groupId];
            // 检查小组状态，处理小组任务
            // 预留接口，暂不实现
        }
    }
}

module.exports = CreepGroup;
