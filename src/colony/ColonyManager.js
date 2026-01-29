/**
 * 殖民地管理器
 * 作为顶层协调者，管理所有房间和跨房间任务
 */

const logger = require('../core/Logger');
const ErrorHandler = require('../core/ErrorHandler');
const MemoryManager = require('../core/MemoryManager');

class ColonyManager {
    constructor() {
        this.memoryManager = MemoryManager;
    }

    /**
     * 初始化殖民地
     */
    init() {
        ErrorHandler.safeExecute(() => {
            // 确保内存已初始化
            if (!this.memoryManager.isInitialized()) {
                this.memoryManager.initialize();
            } else {
                // 验证和修复内存结构
                this.memoryManager.repair();
            }

            // 清理死亡 Creep
            this.memoryManager.cleanDeadCreeps();
            
            // 清理无效任务（每10个tick清理一次，避免频繁清理）
            if (Game.time % 10 === 0) {
                this.memoryManager.cleanInvalidTasks();
            }
        }, 'ColonyManager.init');
    }

    /**
     * 运行殖民地主循环
     */
    run() {
        ErrorHandler.safeExecute(() => {
            this.init();

            // 更新房间列表
            this.updateRooms();

            // 处理跨房间任务
            this.processCrossRoomTasks();

            logger.debug('Colony manager run completed');
        }, 'ColonyManager.run');
    }

    /**
     * 更新房间列表
     */
    updateRooms() {
        const colony = this.memoryManager.getColonyMemory();

        // 检查是否有新的 Spawn
        for (const spawnName in Game.spawns) {
            const spawn = Game.spawns[spawnName];
            const roomName = spawn.room.name;

            if (!colony.rooms[roomName]) {
                this.memoryManager.initializeRoom(roomName, spawn);
                logger.info(`New room detected: ${roomName}`);
            }
        }
    }

    /**
     * 处理跨房间任务
     * 当前阶段仅预留接口
     */
    processCrossRoomTasks() {
        const colony = this.memoryManager.getColonyMemory();
        const crossRoomTasks = colony.crossRoomTasks;

        // TODO: 实现跨房间任务处理逻辑
        // 当前阶段仅预留接口
    }

    /**
     * 获取所有主房间
     * @returns {Array<string>} 房间名称列表
     */
    getMainRooms() {
        const colony = this.memoryManager.getColonyMemory();
        const mainRooms = [];

        for (const roomName in colony.rooms) {
            if (colony.rooms[roomName].type === 'main') {
                mainRooms.push(roomName);
            }
        }

        return mainRooms;
    }

    /**
     * 获取房间对象
     * @param {string} roomName
     * @returns {Room|null}
     */
    getRoom(roomName) {
        return Game.rooms[roomName] || null;
    }
}

module.exports = ColonyManager;
