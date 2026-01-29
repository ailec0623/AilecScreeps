var Tower = require('./structure.tower');
// 使用新的任务发布器和内存管理器
const TaskReleaser = require('./task/TaskReleaser');
const MemoryManager = require('./core/MemoryManager');
const Constants = require('./config/Constants');
const logger = require('./core/Logger');

var Structure = {
    run: function(){
        // 优化：使用GameCache按房间分组处理structures，减少查找开销
        const GameCache = require('./core/GameCache');
        const structuresByRoom = GameCache.structuresByRoom;
        
        for (const roomName in structuresByRoom) {
            const room = Game.rooms[roomName];
            if (!room) continue;
            
            const structuresByType = structuresByRoom[roomName];
            for (const structureType in structuresByType) {
                const structureIds = structuresByType[structureType];
                for (const id of structureIds) {
                    const structure = Game.getObjectById(id);
                    if (!structure || !structure.room) continue;
                    
                    //this.needRepair(structure, room);
                    if(structure.structureType == STRUCTURE_CONTROLLER){
                        this.controllerTasks(structure, room);
                    }else if(structure.structureType == STRUCTURE_STORAGE || structure.structureType == STRUCTURE_CONTAINER){
                        // 如果是storage，自动识别距离最近的link为中央link
                        if(structure.structureType == STRUCTURE_STORAGE){
                            this.identifyCentralLink(room, structure);
                        }
                        this.storageTasks(structure, room);
                        if(structure.store.getUsedCapacity(RESOURCE_ENERGY) < Math.max(0.5 * structure.store.getCapacity(RESOURCE_ENERGY), 2000)){
                            this.deliveryTasks(structure, room, 5, 4);
                        }
                    }else if(structure.structureType == STRUCTURE_SPAWN){
                        // spawn能量不足时就生成delivery任务，不需要等到spawning
                        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            this.deliveryTasks(structure, room, 1, 1);
                        }
                    }else if(structure.structureType == STRUCTURE_EXTENSION){
                        // extension能量不足时就生成delivery任务
                        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            this.deliveryTasks(structure, room, 2, 1);
                        }
                    }else if(structure.structureType == STRUCTURE_TOWER){
                        Tower.run(structure);
                        this.deliveryTasks(structure, room, 3, 1);
                    }else if(structure.structureType == STRUCTURE_NUKER){
                        this.deliveryTasks(structure, room, 3, 1);
                    }else if(structure.structureType == STRUCTURE_LINK){
                        try{
                            const roomMemory = MemoryManager.getRoomMemory(room.name);
                            const centralLinkId = (roomMemory && roomMemory.centralLink) || (room.memory && room.memory.centralLink);
                            
                            if(structure.id == centralLinkId){
                                // 中央link：当能量>=50时生成pickup任务
                                if(structure.store.getUsedCapacity(RESOURCE_ENERGY) >= 50){
                                    this.pickupTasks(structure, room, -100, 2);
                                }
                            }else{
                                // 非中央link：当能量接近满时传递给中央link
                                if(centralLinkId && structure.store.getFreeCapacity(RESOURCE_ENERGY) < 400){
                                    const centralLink = Game.getObjectById(centralLinkId);
                                    if(centralLink && centralLink.store && centralLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0){
                                        const result = structure.transferEnergy(centralLink);
                                        // transferEnergy可能返回ERR_FULL等，但不需要特殊处理，下次tick会重试
                                    }
                                }
                            }
                        }
                        catch(e){
                            // 记录错误但不中断其他结构处理
                            console.log(`[Structure] Error processing link ${structure.id} in ${room.name}:`, e);
                        }

                    }else if(structure.structureType == STRUCTURE_LAB){
                        this.deliveryTasks(structure, room, 4, 2);
                    }else if(structure.structureType == STRUCTURE_POWER_SPAWN){
                        this.deliveryTasks(structure, room, 4, 1);
                        // if(room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0.1 * room.storage.store.getCapacity(RESOURCE_ENERGY)){
                        //     try{
                        //         console.log(structure.processPower());
                        //     }catch{
                        //         console.log(structure);
                        //     }
                            
                        // }
                    }
                }
            }
        }
    },
    needRepair: function(s, room){
        if(s.structureType == STRUCTURE_WALL){
            return;
        }
        if(s.structureType == STRUCTURE_RAMPART){
            return;
        }
        if(s.hitsMax - s.hits > 20){
            // 从新内存路径检查任务数量
            const roomMemory = MemoryManager.getRoomMemory(room.name);
            let haveTask = 0;
            if (roomMemory && roomMemory.localTasks && roomMemory.localTasks.repair) {
                for (let t of roomMemory.localTasks.repair) {
                    if (t.releaserId == s.id) {
                        haveTask += 1;
                        break;
                    }
                }
            }
            if (haveTask == 0) {
                TaskReleaser.releaseTask(room, Constants.TASK_TYPES.REPAIR, s.pos, s.pos, s.id, 1, null);
            }
        }
    },
    pickupTasks: function(s, room, priority,times){
        // 从新内存路径检查任务数量
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        let haveTask = 0;
        if (roomMemory && roomMemory.localTasks && roomMemory.localTasks.pickup) {
            for (let t of roomMemory.localTasks.pickup) {
                if (t.releaserId == s.id) {
                    haveTask += 1;
                }
            }
        }
        
        if (haveTask < times) {
            TaskReleaser.releaseTask(room, Constants.TASK_TYPES.PICKUP, s.pos, s.pos, s.id, priority, null);
        }
    },
    controllerTasks: function(s, room){
        try{
            // 从新内存路径检查任务数量
            const roomMemory = MemoryManager.getRoomMemory(room.name);
            let haveTask = 0;
            if (roomMemory && roomMemory.localTasks && roomMemory.localTasks.upgrade) {
                haveTask = roomMemory.localTasks.upgrade.length;
            }
            
            if(room.controller.level == 8){
                if (haveTask < 5 && room.controller.ticksToDowngrade < 190000) {
                    TaskReleaser.releaseTask(room, Constants.TASK_TYPES.UPGRADE, s.pos, s.pos, s.id, 1, null);
                }
            }else{
                if (haveTask < 5) {
                    TaskReleaser.releaseTask(room, Constants.TASK_TYPES.UPGRADE, s.pos, s.pos, s.id, 1, null);
                }
            }
        }catch(e){
            console.log(room.name)
        }

    },
    storageTasks: function(s, room){
        if(s.store.getUsedCapacity() > 0){
            // 优化：使用GameCache缓存的房间任务统计，避免在循环中重复计算
            const GameCache = require('./core/GameCache');
            const taskStats = GameCache.getRoomTaskStats(room.name);
            
            if (!taskStats) return;
            
            // 如果有其他结构的delivery任务，或者有worker需要能量，才生成getenergy任务
            if (taskStats.delivery > 0 || taskStats.upgrade > 0) {
                const roomMemory = MemoryManager.getRoomMemory(room.name);
                if (!roomMemory || !roomMemory.localTasks) return;
                
                let haveGetenergyTask = 0;
                if (roomMemory.localTasks.getenergy) {
                    haveGetenergyTask = roomMemory.localTasks.getenergy.length;
                }
                
                // 根据需求生成适量的getenergy任务
                // 考虑其他结构的delivery任务和worker的upgrade任务
                const neededGetenergyTasks = Math.min(taskStats.delivery + taskStats.upgrade, 7);
                if (haveGetenergyTask < neededGetenergyTasks) {
                    TaskReleaser.releaseTask(room, Constants.TASK_TYPES.GETENERGY, s.pos, s.pos, s.id, 1, null);
                }
            }
        }
    },
    deliveryTasks: function(s, room, priority, max){
        if(s.store.getFreeCapacity(RESOURCE_ENERGY) <0.2 * s.store.getCapacity(RESOURCE_ENERGY) && s.structureType == STRUCTURE_TOWER){
            return; 
        }
        if(s.store.getFreeCapacity(RESOURCE_ENERGY) == 0){
            return; 
        }
        
        // 从新内存路径检查任务数量（只统计未分配的任务）
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        let haveTask = 0;
        if (roomMemory && roomMemory.localTasks && roomMemory.localTasks.delivery) {
            for (let t of roomMemory.localTasks.delivery) {
                if (t.releaserId == s.id && !t.creepId) {
                    haveTask += 1;
                }
            }
        }
        
        if (haveTask < max) {
            TaskReleaser.releaseTask(room, Constants.TASK_TYPES.DELIVERY, s.pos, s.pos, s.id, priority, null);
        }
    },
    /**
     * 识别中央link（距离storage最近的link）
     * @param {Room} room - 房间对象
     * @param {StructureStorage} storage - Storage对象
     */
    identifyCentralLink: function(room, storage){
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        if(!roomMemory){
            return;
        }
        
        // 每100 tick检查一次，避免频繁计算
        const currentCentralLink = roomMemory.centralLink || (room.memory && room.memory.centralLink);
        if(Game.time % 100 !== 0 && currentCentralLink){
            // 验证当前的centralLink是否还存在
            if(currentCentralLink && Game.getObjectById(currentCentralLink)){
                return;
            }
        }
        
        // 查找房间中所有的link
        const links = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        });
        
        if(links.length === 0){
            roomMemory.centralLink = '';
            if(room.memory){
                room.memory.centralLink = '';
            }
            return;
        }
        
        // 找到距离storage最近的link（使用更高效的方法）
        const closestLink = storage.pos.findClosestByRange(links);
        const minDistance = closestLink ? storage.pos.getRangeTo(closestLink) : Infinity;
        
        // 更新centralLink（同时更新新内存和旧内存路径以保持兼容）
        if(closestLink && currentCentralLink !== closestLink.id){
            roomMemory.centralLink = closestLink.id;
            if(room.memory){
                room.memory.centralLink = closestLink.id;
            }
            console.log(`[Structure] Identified centralLink ${closestLink.id} (distance ${minDistance}) in room ${room.name}`);
        }
    }
}
module.exports = Structure;