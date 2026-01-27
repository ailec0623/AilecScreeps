/**
 * Creep 管理器
 * 支持跨房间工作
 */

const logger = require('../core/Logger');
const ErrorHandler = require('../core/ErrorHandler');
const CreepGroup = require('./CreepGroup');

class CreepManager {
    /**
     * 运行所有 Creep
     */
    static run() {
        ErrorHandler.safeExecute(() => {
            // 处理 Creep 小组（预留）
            CreepGroup.processGroups();

            // 处理所有 Creep
            for (const name in Game.creeps) {
                const creep = Game.creeps[name];
                ErrorHandler.safeExecute(() => {
                    creep.acceptTask();
                    creep.operate();
                    creep.reviewTask();
                }, `CreepManager.run(${name})`);
            }
        }, 'CreepManager.run');
    }
}

module.exports = CreepManager;
