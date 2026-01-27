/**
 * Screeps 主循环入口
 * 使用新的殖民地管理系统
 */

// 导入核心模块
const logger = require('./core/Logger');
const ErrorHandler = require('./core/ErrorHandler');
const ColonyManager = require('./colony/ColonyManager');

// 导入新模块
const SpawnManager = require('./spawn/SpawnManager');
const TaskGenerator = require('./task/TaskGenerator');
const CrossRoomTask = require('./task/CrossRoomTask');
const RoomRepairer = require('./room/RoomRepairer');
const RoomController = require('./room/RoomController');
const RoomBuilder = require('./room/RoomBuilder');

// 导入旧模块（逐步迁移）
const tool = require('./tool');
const Task = require('./task');
const Structures = require('./structures');
const Flags = require('./flags');
const ConstructionSites = require('./constructionsites');

// 加载原型扩展
require('./mount')();

// 导入新的 Creep 管理器
const CreepManager = require('./creep/CreepManager');

// 创建殖民地管理器实例
const colonyManager = new ColonyManager();

/**
 * 游戏主循环
 */
module.exports.loop = function () {
    // 使用错误处理包装整个循环
    ErrorHandler.safeExecute(() => {
        // 初始化殖民地系统
        colonyManager.run();

        // 运行旧系统（逐步迁移）
        tool.run();

        // 处理主房间（使用新的房间控制器）
        const mainRooms = colonyManager.getMainRooms();
        for (const roomName of mainRooms) {
            const room = colonyManager.getRoom(roomName);
            if (room) {
                // 自动生成任务（减少 Flag 依赖）
                TaskGenerator.generateTasks(room);
                
                // 运行房间控制器
                RoomController.runMainRoom(room);
                
                // 保留旧系统作为备用
                // RoomControl.mainRoom(room);
            }
        }

        // 处理跨房间任务
        CrossRoomTask.process();

        // 处理 Spawn（使用新的智能生成系统）
        for (const spawnName in Game.spawns) {
            const spawn = Game.spawns[spawnName];
            const roomName = spawn.room.name;
            if (mainRooms.includes(roomName)) {
                ErrorHandler.safeExecute(() => {
                    SpawnManager.acceptTask(spawn);
                }, `SpawnManager.acceptTask(${spawnName})`);
            }
        }

        // 处理建筑工地
        ConstructionSites.run();

        // 处理旗帜（逐步减少依赖）
        Flags.run();

        // 处理建筑
        Structures.run();

        // 排序任务
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room) {
                Task.sortTasks(room);
            }
        }

        // 运行 Creep（使用新的 Creep 管理器）
        CreepManager.run();
        
        // 保留旧系统作为备用
        // Creeps.run();

        // 取消已完成的任务
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room) {
                ErrorHandler.safeExecute(() => {
                    Task.cancelTask(room);
                }, `Task.cancelTask(${roomName})`);
            }
        }

    }, 'main.loop');
};
