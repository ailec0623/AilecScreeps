var Tower = {
    run: function(tower){
        var inTask = false;
        if(!inTask){
            inTask = this.attackCreeps(tower);
        }
        if(!inTask && tower.store.getUsedCapacity(RESOURCE_ENERGY) >= 500){
            inTask = this.repairStructures(tower);
        }
    },
    attackCreeps: function(tower){
        var targets = tower.room.find(FIND_HOSTILE_CREEPS);
        if(targets.length > 0){
            tower.attack(targets[0]);
            return true;
        }
    },
    /**
     * 更新防御性建筑的耐久上限（每300 tick检查一次）
     * @param {Room} room - 房间对象
     */
    updateDefenseHitsTarget: function(room){
        // 每300 tick检查一次
        if(Game.time % 300 !== 0){
            return;
        }
        
        if(!room.memory.wallHits){
            room.memory.wallHits = 100;
        }
        
        // 查找所有防御性建筑
        const defenses = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART
        });
        
        if(defenses.length === 0){
            return;
        }
        
        // 检查是否所有防御性建筑的耐久都达到当前目标
        const allAtTarget = defenses.every(def => def.hits >= room.memory.wallHits);
        
        if(allAtTarget){
            // 如果所有防御性建筑都达到目标，提升目标耐久
            const currentTarget = room.memory.wallHits;
            const maxHits = Math.max(...defenses.map(d => d.hitsMax));
            
            // 逐步提升，每次增长800点，但不超过最大耐久
            const newTarget = Math.min(
                currentTarget + 800,
                maxHits
            );
            
            if(newTarget > currentTarget){
                room.memory.wallHits = newTarget;
                console.log(`[Tower] Updated wallHits target from ${currentTarget} to ${newTarget} in room ${room.name}`);
            }
        }
    },
    repairStructures: function(tower){
        const room = tower.room;
        
        // 更新防御性建筑的耐久上限（每300 tick检查一次）
        this.updateDefenseHitsTarget(room);
        
        // 初始化 wallHits 如果不存在
        if(!room.memory.wallHits){
            room.memory.wallHits = 100;
        }
        
        // 分离不同类型的建筑
        const roads = [];
        const defenses = [];
        const others = [];
        
        const allStructures = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.hits < structure.hitsMax;
            }
        });
        
        for(const structure of allStructures){
            if(structure.structureType === STRUCTURE_ROAD){
                roads.push(structure);
            } else if(structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART){
                defenses.push(structure);
            } else {
                others.push(structure);
            }
        }
        
        // 优先修理道路：只有路的耐久度过半时才修
        for(const road of roads){
            // 只有当路的耐久度低于50%时才修理
            if(road.hits < road.hitsMax * 0.5){
                tower.repair(road);
                return true;
            }
        }
        
        // 修理防御性建筑：优先修理耐久度更低的
        const defensesNeedingRepair = defenses.filter(d => d.hits < room.memory.wallHits);
        if(defensesNeedingRepair.length > 0){
            // 按耐久度排序，优先修理耐久度更低的
            defensesNeedingRepair.sort((a, b) => a.hits - b.hits);
            tower.repair(defensesNeedingRepair[0]);
            return true;
        }
        
        // 修理其他建筑
        if(others.length > 0){
            tower.repair(others[0]);
            return true;
        }
        
        return false;
    },
}

module.exports = Tower;