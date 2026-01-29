/**
 * Creep 管理器
 * 支持跨房间工作
 * 使用GameCache优化性能
 */

const logger = require('../core/Logger');
const ErrorHandler = require('../core/ErrorHandler');
const CreepGroup = require('./CreepGroup');
const GameCache = require('../core/GameCache');
const AgentRegistry = require('./AgentRegistry');

class CreepManager {
    /**
     * 运行所有 Creep
     * 优化：使用GameCache缓存的creeps列表，按房间分组处理
     */
    static run() {
        ErrorHandler.safeExecute(() => {
            // 处理 Creep 小组（预留）
            CreepGroup.processGroups();

            // 优化：使用GameCache按房间分组处理Creeps
            // 这样可以减少查找开销，并且可以按房间批量处理
            const creepsByRoom = GameCache.creepsByRoom;
            
            for (const roomName in creepsByRoom) {
                const creepsByRole = creepsByRoom[roomName];
                for (const role in creepsByRole) {
                    const creepNames = creepsByRole[role];
                    for (const name of creepNames) {
                        const creep = Game.creeps[name];
                        if (!creep) continue;

                        const agent = AgentRegistry.get(creep);
                        if (!agent) continue;

                        // 调试：低频记录 carrier 的任务状态，帮助排查任务无法结束的问题
                        if (role === 'carrier' && Game.time % 50 === 0) {
                            const task = creep.memory && creep.memory.task;
                            logger.debug(
                                `[CreepManager] carrier ${name} inTask=${creep.memory.inTask ? '1' : '0'} ` +
                                `type=${task && task.type || 'none'} energy=${creep.store.getUsedCapacity(RESOURCE_ENERGY)}`
                            );
                        }

                        ErrorHandler.safeExecute(() => {
                            agent.run();
                        }, `CreepManager.run(${name})`);
                    }
                }
            }
        }, 'CreepManager.run');
    }
}

module.exports = CreepManager;
