/**
 * 游戏对象缓存系统
 * 在tick开始时预处理常用数据，避免重复查找
 * 参考Overmind的GameCache实现
 */

const logger = require('./Logger');

class GameCache {
    constructor() {
        // Creeps按房间和角色分组：creepsByRoom[roomName][role] = [creepNames]
        this.creepsByRoom = {};
        // Creeps到期时间：creepName -> Game.time（用于避免每tick全量扫描）
        this.creepExpiry = {};
        // 是否已经通过全量扫描初始化过creeps索引
        this.creepsInitialized = false;
        
        // Structures按房间和类型分组：structuresByRoom[roomName][type] = [structureIds]
        this.structuresByRoom = {};
        
        // Spawns按房间分组：spawnsByRoom[roomName] = [spawnIds]
        this.spawnsByRoom = {};
        
        // Room级别的缓存（每tick刷新）
        // hostileCreepsByRoom[roomName] = [creepIds] - 敌对creeps
        this.hostileCreepsByRoom = {};
        // hostileStructuresByRoom[roomName] = [structureIds] - 敌对structures
        this.hostileStructuresByRoom = {};
        // harvestSourceOccupancy[roomName][sourceId] = creepId - 采矿点占用情况
        this.harvestSourceOccupancy = {};
        // carrierCountByRoom[roomName] = {required, current} - carrier数量统计
        this.carrierCountByRoom = {};
        // roomTaskStats[roomName] = {delivery, upgrade, getenergy} - 房间任务统计
        this.roomTaskStats = {};
        
        // 上次整体刷新时间（只用于防止同tick多次refresh）
        this.lastRefresh = 0;
        // 上次结构缓存刷新时间（结构变化很少，可以降低频率）
        this.lastStructureRefresh = 0;
    }

    /**
     * 刷新缓存（每tick调用一次）
     * 说明：
     * - creeps：只在第一次全量扫描，之后依赖生成/过期维护，不再每tick全量扫描
     * - spawns：数量很少，每tick扫描一次问题不大
     * - structures：变化很少，只每隔若干tick刷新一次，减少CPU开销
     * 同时输出各部分耗时，便于分析性能
     */
    refresh() {
        const startCpu = Game.cpu.getUsed();
        let lastCpu = startCpu;
        let cpu;

        // 只在每tick刷新一次
        if (this.lastRefresh === Game.time) {
            return;
        }
        this.lastRefresh = Game.time;

        // 第一次运行时，对现有creeps做一次全量扫描作为初始化
        if (!this.creepsInitialized) {
            this.creepsByRoom = {};
            this.creepExpiry = {};
            this.cacheCreepsByRoom();
            cpu = Game.cpu.getUsed();
            logger.debug(`[CPU] GameCache.cacheCreepsByRoom (init): ${(cpu - lastCpu).toFixed(3)}ms`);
            lastCpu = cpu;
            this.creepsInitialized = true;
        }

        // 周期性清理过期 / 已死亡的creep，避免索引无限增长
        const CREEP_CLEAN_INTERVAL = 20;
        if (Game.time % CREEP_CLEAN_INTERVAL === 0) {
            this.cleanupExpiredCreeps();
            cpu = Game.cpu.getUsed();
            logger.debug(`[CPU] GameCache.cleanupExpiredCreeps: ${(cpu - lastCpu).toFixed(3)}ms`);
            lastCpu = cpu;
        }

        // 每tick刷新：Spawns（数量有限，遍历开销很小）
        this.spawnsByRoom = {};
        this.cacheSpawnsByRoom();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] GameCache.cacheSpawnsByRoom: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        // Structures 刷新频率较低（例如每10 tick一次）
        const STRUCTURE_REFRESH_INTERVAL = 10;
        if (!this.lastStructureRefresh ||
            Game.time - this.lastStructureRefresh >= STRUCTURE_REFRESH_INTERVAL) {
            this.lastStructureRefresh = Game.time;
            this.structuresByRoom = {};
            this.cacheStructuresByRoom();
            cpu = Game.cpu.getUsed();
            logger.debug(`[CPU] GameCache.cacheStructuresByRoom: ${(cpu - lastCpu).toFixed(3)}ms`);
            lastCpu = cpu;
        }

        // 刷新Room级别的缓存（每tick刷新）
        this.cacheRoomLevelData();
        cpu = Game.cpu.getUsed();
        logger.debug(`[CPU] GameCache.cacheRoomLevelData: ${(cpu - lastCpu).toFixed(3)}ms`);
        lastCpu = cpu;

        const totalCpu = Game.cpu.getUsed() - startCpu;
        logger.debug(`[CPU] GameCache.refresh total: ${totalCpu.toFixed(3)}ms`);
    }

    /**
     * 全量扫描一次Creeps按房间和角色分组
     * 只在初始化时调用，之后通过registerCreep/cleanupExpiredCreeps维护
     */
    cacheCreepsByRoom() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            const roomName = creep.room ? creep.room.name : (creep.memory.room || 'unknown');
            const role = creep.memory.role || 'unknown';

            if (!this.creepsByRoom[roomName]) {
                this.creepsByRoom[roomName] = {};
            }
            if (!this.creepsByRoom[roomName][role]) {
                this.creepsByRoom[roomName][role] = [];
            }
            this.creepsByRoom[roomName][role].push(name);
            // 标准寿命1500tick，这里给一点冗余
            this.creepExpiry[name] = Game.time + 1600;
        }
    }

    /**
     * 在生成新creep时注册到索引中（由SpawnManager调用）
     * @param {string} name  - creep 名称
     * @param {string} roomName - 所属房间
     * @param {string} role - 角色
     */
    registerCreep(name, roomName, role) {
        if (!this.creepsByRoom[roomName]) {
            this.creepsByRoom[roomName] = {};
        }
        if (!this.creepsByRoom[roomName][role]) {
            this.creepsByRoom[roomName][role] = [];
        }
        if (!this.creepsByRoom[roomName][role].includes(name)) {
            this.creepsByRoom[roomName][role].push(name);
        }
        // 记录到期时间（标准寿命1500tick，再多给一点缓冲）
        this.creepExpiry[name] = Game.time + 1600;
    }

    /**
     * 周期性清理过期或已经不在Game.creeps中的Creep索引
     */
    cleanupExpiredCreeps() {
        for (const roomName in this.creepsByRoom) {
            const roles = this.creepsByRoom[roomName];
            for (const role in roles) {
                const names = roles[role];
                const filtered = [];
                for (const name of names) {
                    const expire = this.creepExpiry[name];
                    const alive = !!Game.creeps[name];
                    if (expire && expire <= Game.time) {
                        delete this.creepExpiry[name];
                        continue;
                    }
                    if (!alive) {
                        delete this.creepExpiry[name];
                        continue;
                    }
                    filtered.push(name);
                }
                roles[role] = filtered;
            }
        }
    }

    /**
     * 缓存Structures按房间和类型分组
     * 说明：
     * - 这里**跳过道路、城墙、rampart**，这些由 RoomRepairer / Tower 自己用 room.find 动态处理
     * - 这样可以显著减少需要缓存的结构数量（通常道路和城墙数量远大于功能建筑）
     */
    cacheStructuresByRoom() {
        for (const id in Game.structures) {
            const structure = Game.structures[id];
            if (!structure || !structure.room) continue;

            const type = structure.structureType;
            // 跳过大量且不依赖 GameCache 的结构，降低 CPU 开销
            if (type === STRUCTURE_ROAD ||
                type === STRUCTURE_WALL ||
                type === STRUCTURE_RAMPART) {
                continue;
            }

            const roomName = structure.room.name;

            if (!this.structuresByRoom[roomName]) {
                this.structuresByRoom[roomName] = {};
            }
            if (!this.structuresByRoom[roomName][type]) {
                this.structuresByRoom[roomName][type] = [];
            }
            this.structuresByRoom[roomName][type].push(id);
        }
    }

    /**
     * 缓存Spawns按房间分组
     */
    cacheSpawnsByRoom() {
        for (const name in Game.spawns) {
            const spawn = Game.spawns[name];
            const roomName = spawn.room.name;

            if (!this.spawnsByRoom[roomName]) {
                this.spawnsByRoom[roomName] = [];
            }
            this.spawnsByRoom[roomName].push(name);
        }
    }

    /**
     * 获取房间的Creeps（按角色）
     * @param {string} roomName - 房间名称
     * @param {string} role - 角色名称（可选）
     * @returns {Array<string>|Object} Creep名称数组或按角色分组的对象
     */
    getCreepsByRoom(roomName, role = null) {
        if (!this.creepsByRoom[roomName]) {
            return role ? [] : {};
        }
        if (role) {
            return this.creepsByRoom[roomName][role] || [];
        }
        return this.creepsByRoom[roomName];
    }

    /**
     * 获取房间的Structures（按类型）
     * @param {string} roomName - 房间名称
     * @param {string} structureType - 结构类型（可选）
     * @returns {Array<string>|Object} Structure ID数组或按类型分组的对象
     */
    getStructuresByRoom(roomName, structureType = null) {
        if (!this.structuresByRoom[roomName]) {
            return structureType ? [] : {};
        }
        if (structureType) {
            return this.structuresByRoom[roomName][structureType] || [];
        }
        return this.structuresByRoom[roomName];
    }

    /**
     * 获取房间的Spawns
     * @param {string} roomName - 房间名称
     * @returns {Array<string>} Spawn名称数组
     */
    getSpawnsByRoom(roomName) {
        return this.spawnsByRoom[roomName] || [];
    }

    /**
     * 获取指定房间和角色的Creep对象数组
     * @param {string} roomName - 房间名称
     * @param {string} role - 角色名称
     * @returns {Array<Creep>} Creep对象数组
     */
    getCreepObjects(roomName, role) {
        const creepNames = this.getCreepsByRoom(roomName, role);
        const creeps = [];
        for (const name of creepNames) {
            if (Game.creeps[name]) {
                creeps.push(Game.creeps[name]);
            }
        }
        return creeps;
    }

    /**
     * 获取指定房间和类型的Structure对象数组
     * @param {string} roomName - 房间名称
     * @param {string} structureType - 结构类型
     * @returns {Array<Structure>} Structure对象数组
     */
    getStructureObjects(roomName, structureType) {
        const structureIds = this.getStructuresByRoom(roomName, structureType);
        const structures = [];
        for (const id of structureIds) {
            const structure = Game.getObjectById(id);
            if (structure) {
                structures.push(structure);
            }
        }
        return structures;
    }

    /**
     * 缓存Room级别的数据（每tick刷新）
     * 包括：敌对creeps、敌对structures、采矿点占用、carrier数量、任务统计等
     */
    cacheRoomLevelData() {
        // 清空旧数据
        this.hostileCreepsByRoom = {};
        this.hostileStructuresByRoom = {};
        this.harvestSourceOccupancy = {};
        this.carrierCountByRoom = {};
        this.roomTaskStats = {};

        // 遍历所有房间
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room) continue;

            // 缓存敌对creeps
            const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
            this.hostileCreepsByRoom[roomName] = hostileCreeps.map(c => c.id);

            // 缓存敌对structures
            const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType !== STRUCTURE_CONTROLLER &&
                            s.structureType !== STRUCTURE_WALL &&
                            s.structureType !== STRUCTURE_RAMPART
            });
            this.hostileStructuresByRoom[roomName] = hostileStructures.map(s => s.id);

            // 缓存采矿点占用情况（harvesterpro任务）
            this.harvestSourceOccupancy[roomName] = {};
            const harvesterNames = this.getCreepsByRoom(roomName, 'harvesterpro');
            for (const name of harvesterNames) {
                const creep = Game.creeps[name];
                if (!creep || creep.spawning || !creep.memory.inTask) continue;
                const task = creep.memory.task;
                if (task && task.type === 'harvestpro' && task.releaserId) {
                    this.harvestSourceOccupancy[roomName][task.releaserId] = creep.id;
                }
            }

            // 获取房间内存（用于后续计算）
            const MemoryManager = require('./MemoryManager');
            const roomMemory = MemoryManager.getRoomMemory(roomName);

            // 缓存carrier数量统计（每10 tick计算一次，避免频繁计算）
            if (Game.time % 10 === 0 && roomMemory) {
                const SpawnScheduler = require('../spawn/SpawnScheduler');
                const requiredCount = SpawnScheduler.calculateCarrierCount(room, roomMemory);
                const carrierNames = this.getCreepsByRoom(roomName, 'carrier');
                const currentCount = carrierNames.filter(name => {
                    const carrier = Game.creeps[name];
                    return carrier && !carrier.spawning;
                }).length;
                
                this.carrierCountByRoom[roomName] = {
                    required: requiredCount,
                    current: currentCount
                };
            }

            // 缓存任务统计（用于storageTasks优化）
            if (roomMemory && roomMemory.localTasks) {
                const stats = {
                    delivery: 0,
                    upgrade: 0,
                    getenergy: 0
                };
                
                // 统计非storage结构的delivery任务
                if (roomMemory.localTasks.delivery) {
                    stats.delivery = roomMemory.localTasks.delivery.filter(t => {
                        if (t.creepId) return false;
                        const target = Game.getObjectById(t.releaserId);
                        return target && target.structureType !== STRUCTURE_STORAGE && 
                               target.structureType !== STRUCTURE_CONTAINER;
                    }).length;
                }
                
                // 统计upgrade任务
                if (roomMemory.localTasks.upgrade) {
                    stats.upgrade = roomMemory.localTasks.upgrade.filter(t => !t.creepId).length;
                }
                
                // 统计getenergy任务
                if (roomMemory.localTasks.getenergy) {
                    stats.getenergy = roomMemory.localTasks.getenergy.length;
                }
                
                this.roomTaskStats[roomName] = stats;
            }
        }
    }

    /**
     * 获取房间的敌对creeps
     * @param {string} roomName - 房间名称
     * @returns {Array<Creep>} 敌对creep对象数组
     */
    getHostileCreeps(roomName) {
        const creepIds = this.hostileCreepsByRoom[roomName] || [];
        const creeps = [];
        for (const id of creepIds) {
            const creep = Game.getObjectById(id);
            if (creep) {
                creeps.push(creep);
            }
        }
        return creeps;
    }

    /**
     * 获取房间的敌对structures
     * @param {string} roomName - 房间名称
     * @returns {Array<Structure>} 敌对structure对象数组
     */
    getHostileStructures(roomName) {
        const structureIds = this.hostileStructuresByRoom[roomName] || [];
        const structures = [];
        for (const id of structureIds) {
            const structure = Game.getObjectById(id);
            if (structure) {
                structures.push(structure);
            }
        }
        return structures;
    }

    /**
     * 检查采矿点是否被占用
     * @param {string} roomName - 房间名称
     * @param {string} sourceId - 能量源ID
     * @returns {boolean} 是否被占用
     */
    isHarvestSourceOccupied(roomName, sourceId) {
        return !!(this.harvestSourceOccupancy[roomName] && 
                  this.harvestSourceOccupancy[roomName][sourceId]);
    }

    /**
     * 获取房间的carrier数量统计
     * @param {string} roomName - 房间名称
     * @returns {Object|null} {required, current} 或 null
     */
    getCarrierCount(roomName) {
        return this.carrierCountByRoom[roomName] || null;
    }

    /**
     * 获取房间的任务统计
     * @param {string} roomName - 房间名称
     * @returns {Object|null} {delivery, upgrade, getenergy} 或 null
     */
    getRoomTaskStats(roomName) {
        return this.roomTaskStats[roomName] || null;
    }
}

// 导出单例
const gameCache = new GameCache();
module.exports = gameCache;
