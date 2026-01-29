/**
 * 内存管理抽象层
 * 使用独立路径 Memory.colony_v2 避免版本冲突
 * 支持自动初始化
 */

const logger = require('./Logger');
const ErrorHandler = require('./ErrorHandler');

const MEMORY_PATH = 'colony_v2';
const VERSION = '2.0';

// 内存持久化：保存解析后的内存到全局（已迁移到global，这里保留注释）
// let lastMemory = null; // 已迁移到 global._lastMemory
// let lastTime = 0; // 已迁移到 global._lastTime

class MemoryManager {
    constructor() {
        this.memoryPath = MEMORY_PATH;
        this.version = VERSION;
    }

    /**
     * 加载已解析的内存（避免JSON.parse开销）
     * 参考Overmind的Mem.load()实现
     */
    load() {
        // 从全局恢复上次保存的内存
        if (global._lastMemory && global._lastTime && Game.time === global._lastTime + 1) {
            // 连续tick，尝试使用已解析的内存
            // 注意：Screeps的Memory是自动解析的，我们主要是避免重复访问
            // 这里主要是标记已经加载过，实际的内存解析由Screeps引擎完成
        }
        // 首次运行或非连续tick时，正常解析（由Screeps引擎自动完成）
    }

    /**
     * 保存解析后的内存到全局（供下个tick使用）
     * 参考Overmind的Mem实现
     */
    save() {
        // 保存当前内存状态到全局，供下个tick参考
        // 注意：实际的内存持久化由Screeps引擎完成
        // 这里主要是标记保存时间
        global._lastTime = Game.time;
    }

    /**
     * 获取内存根对象
     * @returns {Object} 内存对象
     */
    getMemory() {
        if (!Memory[this.memoryPath]) {
            Memory[this.memoryPath] = {};
        }
        return Memory[this.memoryPath];
    }

    /**
     * 检查是否已初始化
     * @returns {boolean}
     */
    isInitialized() {
        const memory = this.getMemory();
        return memory.initialized === true && memory.version === this.version;
    }

    /**
     * 初始化内存结构
     */
    initialize() {
        const memory = this.getMemory();

        if (this.isInitialized()) {
            logger.debug('Memory already initialized');
            return;
        }

        logger.info('Initializing memory structure...');

        // 基础结构
        memory.version = this.version;
        memory.initialized = true;
        memory.initializedAt = Game.time;

        // 殖民地结构
        memory.colony = {
            rooms: {},
            crossRoomTasks: {
                transport: [],
                attack: [],
                expand: []
            },
            groups: {}, // Creep 小组（预留）
            config: {
                autoBuild: true,
                autoExpand: false
            }
        };

        // 初始化主房间
        this.initializeMainRooms();

        logger.info('Memory initialized successfully');
    }

    /**
     * 初始化主房间
     */
    initializeMainRooms() {
        const memory = this.getMemory();
        const colony = memory.colony;

        for (const spawnName in Game.spawns) {
            const spawn = Game.spawns[spawnName];
            const roomName = spawn.room.name;

            if (!colony.rooms[roomName]) {
                this.initializeRoom(roomName, spawn);
            }
        }
    }

    /**
     * 初始化房间内存
     * @param {string} roomName - 房间名称
     * @param {StructureSpawn} spawn - Spawn 对象（可选）
     */
    initializeRoom(roomName, spawn = null) {
        const memory = this.getMemory();
        const colony = memory.colony;

        if (colony.rooms[roomName]) {
            return; // 已初始化
        }

        logger.info(`Initializing room: ${roomName}`);

        const room = Game.rooms[roomName];
        const firstSpawn = spawn || (room && room.find(FIND_MY_SPAWNS)[0]);

        colony.rooms[roomName] = {
            type: 'main', // main 或 extension
            controller: room && room.controller ? {
                id: room.controller.id,
                level: room.controller.level
            } : null,
            spawns: [],
            firstSpawn: firstSpawn ? {
                id: firstSpawn.id,
                pos: { x: firstSpawn.pos.x, y: firstSpawn.pos.y }
            } : null,
            extension: [], // 扩展房间列表
            status: 'normal', // normal, underAttack, expanding
            localTasks: {
                harvestpro: [],
                pickup: [],
                delivery: [],
                getenergy: [],
                repair: [],
                build: [],
                upgrade: [],
                reserve: [],
                guard: [],
                spawn: []
            },
            colonyTasks: [], // 参与的殖民地任务
            repairStrategy: {
                roadPriority: 1,
                wallHits: 100,
                rampartHits: 100
            },
            buildings: {
                STRUCTURE_TOWER: 0,
                STRUCTURE_ROAD: 0,
                STRUCTURE_EXTENSION: 0,
                STRUCTURE_LINK: 0,
                STRUCTURE_FACTORY: 0,
                STRUCTURE_LAB: 0,
                STRUCTURE_NUKER: 0,
                STRUCTURE_OBSERVER: 0,
                STRUCTURE_POWER_SPAWN: 0,
                STRUCTURE_SPAWN: 0,
                STRUCTURE_STORAGE: 0,
                STRUCTURE_TERMINAL: 0
            },
            centralLink: '',
            claimRoom: '',
            destroy: [],
            plan: null // 规划信息（预留）
        };

        // 初始化任务列表
        this.initializeRoomTasks(roomName);
    }

    /**
     * 初始化房间任务列表
     * @param {string} roomName
     */
    initializeRoomTasks(roomName) {
        const memory = this.getMemory();
        const room = memory.colony.rooms[roomName];

        if (!room) {
            return;
        }

        // 确保所有任务列表都存在
        const taskTypes = ['harvestpro', 'pickup', 'delivery', 'getenergy', 
                          'repair', 'build', 'upgrade', 'reserve', 'guard', 'spawn'];
        
        for (const taskType of taskTypes) {
            if (!room.localTasks[taskType]) {
                room.localTasks[taskType] = [];
            }
        }
    }

    /**
     * 获取房间内存
     * @param {string} roomName
     * @returns {Object|null}
     */
    getRoomMemory(roomName) {
        const memory = this.getMemory();
        return memory.colony.rooms[roomName] || null;
    }

    /**
     * 获取殖民地内存
     * @returns {Object}
     */
    getColonyMemory() {
        const memory = this.getMemory();
        return memory.colony;
    }

    /**
     * 清理无效任务（releaser不存在或任务过期）
     */
    cleanInvalidTasks() {
        const colony = this.getColonyMemory();
        const maxTaskAge = 10000; // 任务最大存活时间（tick）
        const currentTime = Game.time;
        
        // 清理本地任务
        for (const roomName in colony.rooms) {
            const roomMemory = colony.rooms[roomName];
            if (!roomMemory || !roomMemory.localTasks) continue;
            
            for (const taskType in roomMemory.localTasks) {
                const tasks = roomMemory.localTasks[taskType];
                if (!Array.isArray(tasks)) continue;

                // 对于 pickup 任务，限制同一掉落点/容器的未分配任务数量不超过 2
                const perTargetPickupCount = taskType === 'pickup' ? {} : null;
                
                // 从后往前遍历，避免删除时索引问题
                for (let i = tasks.length - 1; i >= 0; i--) {
                    const task = tasks[i];
                    if (!task) {
                        tasks.splice(i, 1);
                        continue;
                    }

                    // 先做 pickup 任务去重：同一 releaserId 未分配任务最多保留 2 个
                    if (taskType === 'pickup' && task.releaserId && !task.creepId) {
                        const key = task.releaserId;
                        if (!perTargetPickupCount[key]) {
                            perTargetPickupCount[key] = 0;
                        }
                        perTargetPickupCount[key]++;
                        if (perTargetPickupCount[key] > 2) {
                            tasks.splice(i, 1);
                            logger.debug(`cleanInvalidTasks: Removed extra pickup task ${task.releaserId} in ${roomName} - more than 2 unassigned tasks for this target`);
                            continue;
                        }
                    }
                    
                    // 检查releaser是否存在
                    if (task.releaserId) {
                        const releaser = Game.getObjectById(task.releaserId);
                        if (!releaser) {
                            // releaser不存在，删除任务
                            tasks.splice(i, 1);
                            logger.debug(`cleanInvalidTasks: Removed invalid task ${task.releaserId} (${taskType}) in ${roomName} - releaser no longer exists`);
                            continue;
                        }
                        
                        // 对于 delivery 任务，检查目标是否已满（只清理未分配的任务）
                        if (taskType === 'delivery' && !task.creepId && releaser.store) {
                            const freeCapacity = releaser.store.getFreeCapacity(RESOURCE_ENERGY);
                            if (freeCapacity === 0) {
                                // 目标已满，删除未分配的任务
                                tasks.splice(i, 1);
                                logger.debug(`cleanInvalidTasks: Removed delivery task ${task.releaserId} in ${roomName} - target is full`);
                                continue;
                            }
                        }
                    }
                    
                    // 检查任务是否过期（创建时间过久）
                    if (task.createdAt && (currentTime - task.createdAt) > maxTaskAge) {
                        tasks.splice(i, 1);
                        logger.debug(`cleanInvalidTasks: Removed expired task ${task.releaserId || 'unknown'} (${taskType}) in ${roomName} - age: ${currentTime - task.createdAt}`);
                        continue;
                    }
                }
            }
        }
        
        // 清理跨房间任务
        if (colony && colony.crossRoomTasks) {
            for (const taskListName of ['transport', 'attack', 'expand']) {
                const taskList = colony.crossRoomTasks[taskListName];
                if (!Array.isArray(taskList)) continue;
                
                for (let i = taskList.length - 1; i >= 0; i--) {
                    const task = taskList[i];
                    if (!task) {
                        taskList.splice(i, 1);
                        continue;
                    }
                    
                    // 检查releaser是否存在
                    if (task.releaserId) {
                        const releaser = Game.getObjectById(task.releaserId);
                        if (!releaser) {
                            taskList.splice(i, 1);
                            logger.debug(`cleanInvalidTasks: Removed invalid cross-room task ${task.releaserId} (${taskListName}) - releaser no longer exists`);
                            continue;
                        }
                    }
                    
                    // 检查任务是否过期
                    if (task.createdAt && (currentTime - task.createdAt) > maxTaskAge) {
                        taskList.splice(i, 1);
                        logger.debug(`cleanInvalidTasks: Removed expired cross-room task ${task.releaserId || 'unknown'} (${taskListName}) - age: ${currentTime - task.createdAt}`);
                        continue;
                    }
                }
            }
        }
    }

    /**
     * 清理死亡 Creep 的内存
     */
    cleanDeadCreeps() {
        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                // 清理任务分配
                const creepMemory = Memory.creeps[name];
                if (creepMemory && creepMemory.task && creepMemory.task.releaserId) {
                    // 清理任务中的 creepId
                    const colony = this.getColonyMemory();
                    const roomMemory = this.getRoomMemory(creepMemory.room);
                    
                    if (roomMemory && roomMemory.localTasks) {
                        for (const taskType in roomMemory.localTasks) {
                            const tasks = roomMemory.localTasks[taskType];
                            for (const task of tasks) {
                                if (task.creepId === name) {
                                    task.creepId = null;
                                    logger.debug(`cleanDeadCreeps: Released task ${task.releaserId} (${taskType}) - creep ${name} is dead`);
                                }
                            }
                        }
                    }
                    
                    // 清理跨房间任务
                    if (colony && colony.crossRoomTasks) {
                        for (const taskList of [colony.crossRoomTasks.transport, colony.crossRoomTasks.attack, colony.crossRoomTasks.expand]) {
                            for (const task of taskList) {
                                if (task.creepId === name) {
                                    task.creepId = null;
                                    logger.debug(`cleanDeadCreeps: Released cross-room task ${task.releaserId} - creep ${name} is dead`);
                                }
                            }
                        }
                    }
                }
                
                delete Memory.creeps[name];
            }
        }
        
        // 额外检查：清理所有任务中指向不存在Creep的分配
        const colony = this.getColonyMemory();
        for (const roomName in colony.rooms) {
            const roomMemory = colony.rooms[roomName];
            if (roomMemory && roomMemory.localTasks) {
                for (const taskType in roomMemory.localTasks) {
                    const tasks = roomMemory.localTasks[taskType];
                    for (const task of tasks) {
                        if (task.creepId && !Game.getObjectById(task.creepId)) {
                            task.creepId = null;
                            logger.debug(`cleanDeadCreeps: Released task ${task.releaserId} (${taskType}) in ${roomName} - assigned creep no longer exists`);
                        }
                    }
                }
            }
        }
        
        // 清理跨房间任务
        if (colony && colony.crossRoomTasks) {
            for (const taskList of [colony.crossRoomTasks.transport, colony.crossRoomTasks.attack, colony.crossRoomTasks.expand]) {
                for (const task of taskList) {
                    if (task.creepId && !Game.getObjectById(task.creepId)) {
                        task.creepId = null;
                        logger.debug(`cleanDeadCreeps: Released cross-room task ${task.releaserId} - assigned creep no longer exists`);
                    }
                }
            }
        }
    }

    /**
     * 验证内存结构
     * @returns {boolean} 是否有效
     */
    validate() {
        const memory = this.getMemory();
        
        if (!memory.colony) {
            logger.warn('Memory structure invalid: missing colony');
            return false;
        }

        if (!memory.colony.rooms) {
            logger.warn('Memory structure invalid: missing rooms');
            return false;
        }

        return true;
    }

    /**
     * 修复内存结构
     */
    repair() {
        if (!this.validate()) {
            logger.warn('Repairing memory structure...');
            this.initialize();
        }
    }
}

// 导出单例
const memoryManager = new MemoryManager();
module.exports = memoryManager;
