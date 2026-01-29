/**
 * Screeps 主循环入口
 * 使用新的殖民地管理系统
 */

// 导入核心模块
const logger = require('./core/Logger');
const ErrorHandler = require('./core/ErrorHandler');
const ColonyManager = require('./colony/ColonyManager');
const MemoryManager = require('./core/MemoryManager');
const GameCache = require('./core/GameCache');

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
    const startCpu = Game.cpu.getUsed();
    let lastCpu = startCpu;
    
    // 使用错误处理包装整个循环
    ErrorHandler.safeExecute(() => {
        // CPU优化：加载已解析的内存（避免JSON.parse）
        MemoryManager.load();
        let cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] MemoryManager.load: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;
        
        // CPU优化：刷新游戏对象缓存（在tick开始时预处理）
        GameCache.refresh();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] GameCache.refresh: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;
        
        // 内存清理：清理过期缓存（每100个tick清理一次，避免频繁清理）
        if (Game.time % 100 === 0) {
            const GlobalCache = require('./core/GlobalCache');
            GlobalCache.cleanExpired();
            cpu = Game.cpu.getUsed();
            logger.debug(`[CPU] GlobalCache.cleanExpired: ${(cpu - lastCpu).toFixed(3)}ms`);
            lastCpu = cpu;
        }
        
        // 初始化殖民地系统（包含清理死亡Creep）
        colonyManager.run();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] colonyManager.run: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // 运行旧系统（逐步迁移）
        tool.run();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] tool.run: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

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
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] RoomController (${mainRooms.length} rooms): ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // 处理跨房间任务
        CrossRoomTask.process();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] CrossRoomTask.process: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // 处理 Spawn（使用新的智能生成系统）
        // 优化：使用GameCache缓存的spawns列表
        for (const roomName of mainRooms) {
            const spawnNames = GameCache.getSpawnsByRoom(roomName);
            for (const spawnName of spawnNames) {
                const spawn = Game.spawns[spawnName];
                if (spawn) {
                    ErrorHandler.safeExecute(() => {
                        SpawnManager.acceptTask(spawn);
                    }, `SpawnManager.acceptTask(${spawnName})`);
                }
            }
        }
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] SpawnManager: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // 处理建筑工地
        ConstructionSites.run();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] ConstructionSites.run: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // 处理旗帜（逐步减少依赖）
        Flags.run();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] Flags.run: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // 处理建筑
        Structures.run();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] Structures.run: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // 排序任务
        // 优化：只处理主房间，减少遍历
        for (const roomName of mainRooms) {
            const room = Game.rooms[roomName];
            if (room) {
                Task.sortTasks(room);
            }
        }
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] Task.sortTasks: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // 运行 Creep（使用新的 Creep 管理器）
        CreepManager.run();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] CreepManager.run: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;
        
        // 保留旧系统作为备用
        // Creeps.run();

        // 取消已完成的任务
        // 优化：只处理主房间，减少遍历
        for (const roomName of mainRooms) {
            const room = Game.rooms[roomName];
            if (room) {
                ErrorHandler.safeExecute(() => {
                    Task.cancelTask(room);
                }, `Task.cancelTask(${roomName})`);
            }
        }
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] Task.cancelTask: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // CPU优化：保存解析后的内存到全局（供下个tick使用）
        MemoryManager.save();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] MemoryManager.save: ${(cpu - lastCpu).toFixed(3)}ms`);
        
        // 输出总CPU使用量
        const totalCpu = cpu - startCpu;
        logger.info(`[CPU] Total: ${totalCpu.toFixed(3)}ms / ${Game.cpu.limit}ms (${((totalCpu / Game.cpu.limit) * 100).toFixed(1)}%)`);

    }, 'main.loop');
};
