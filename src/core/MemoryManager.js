/**
 * 内存管理抽象层
 * 使用独立路径 Memory.colony_v2 避免版本冲突
 * 支持自动初始化
 */

const logger = require('./Logger');
const ErrorHandler = require('./ErrorHandler');

const MEMORY_PATH = 'colony_v2';
const VERSION = '2.0';

class MemoryManager {
    constructor() {
        this.memoryPath = MEMORY_PATH;
        this.version = VERSION;
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
