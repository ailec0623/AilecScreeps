var logger = require('./core/Logger');

var Tower = {
    run: function(tower){
        const start = Game.cpu.getUsed();

        let inTask = false;
        let t0 = Game.cpu.getUsed();

        inTask = this.attackCreeps(tower);
        let t1 = Game.cpu.getUsed();

        let repairTime = 0;
        if(!inTask && tower.store.getUsedCapacity(RESOURCE_ENERGY) >= 500){
            const tBeforeRepair = Game.cpu.getUsed();
            inTask = this.repairStructures(tower);
            const tAfterRepair = Game.cpu.getUsed();
            repairTime = tAfterRepair - tBeforeRepair;
        }

        const total = Game.cpu.getUsed() - start;
        const attackTime = t1 - t0;

        logger.debug(
            `[CPU] Tower.run ${tower.room.name}/${tower.id}: ` +
            `attack=${attackTime.toFixed(3)}ms, ` +
            `repair=${repairTime.toFixed(3)}ms, total=${total.toFixed(3)}ms`
        );
    },
    attackCreeps: function(tower){
        // 优化：使用GameCache缓存的hostile creeps，避免每个tower都查找
        const GameCache = require('./core/GameCache');
        const targets = GameCache.getHostileCreeps(tower.room.name);
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

    /**
     * 为房间准备一次性的塔修理上下文（每tick每房间只计算一次）
     * @param {Room} room
     */
    prepareRepairContext: function(room){
        if (room._towerRepairCtx && room._towerRepairCtx.tick === Game.time) {
            return room._towerRepairCtx;
        }

        const start = Game.cpu.getUsed();

        // 更新防御性建筑目标血量
        this.updateDefenseHitsTarget(room);
        if(!room.memory.wallHits){
            room.memory.wallHits = 100;
        }

        const roads = [];
        const defenses = [];
        const others = [];

        const allStructures = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.hits < structure.hitsMax
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

        const defensesNeedingRepair = defenses.filter(d => d.hits < room.memory.wallHits);
        // 按血量排序，优先修最低的
        defensesNeedingRepair.sort((a, b) => a.hits - b.hits);

        const ctx = {
            tick: Game.time,
            roads,
            defensesNeedingRepair,
            others
        };

        room._towerRepairCtx = ctx;

        const end = Game.cpu.getUsed();
        logger.debug(
            `[CPU] Tower.ctx ${room.name}: scan+classify=${(end - start).toFixed(3)}ms, ` +
            `roads=${roads.length}, defenses=${defensesNeedingRepair.length}, others=${others.length}`
        );

        return ctx;
    },

    repairStructures: function(tower){
        const room = tower.room;
        const ctx = this.prepareRepairContext(room);

        const start = Game.cpu.getUsed();

        // 优先修理道路：只有路的耐久度过半时才修
        for(const road of ctx.roads){
            if(road.hits < road.hitsMax * 0.5){
                tower.repair(road);
                const end = Game.cpu.getUsed();
                logger.debug(
                    `[CPU] Tower.repair road ${tower.room.name}/${tower.id}: ` +
                    `pick+repair=${(end - start).toFixed(3)}ms`
                );
                return true;
            }
        }
        
        // 修理防御性建筑：优先修理耐久度更低的
        if(ctx.defensesNeedingRepair.length > 0){
            const target = ctx.defensesNeedingRepair[0];
            tower.repair(target);
            const end = Game.cpu.getUsed();
            logger.debug(
                `[CPU] Tower.repair defenses ${tower.room.name}/${tower.id}: ` +
                `pick+repair=${(end - start).toFixed(3)}ms`
            );
            return true;
        }
        
        // 修理其他建筑
        if(ctx.others.length > 0){
            tower.repair(ctx.others[0]);
            const end = Game.cpu.getUsed();
            logger.debug(
                `[CPU] Tower.repair others ${tower.room.name}/${tower.id}: ` +
                `pick+repair=${(end - start).toFixed(3)}ms`
            );
            return true;
        }
        
        const end = Game.cpu.getUsed();
        logger.debug(
            `[CPU] Tower.repairStructures ${tower.room.name}/${tower.id}: ` +
            `noTarget, total=${(end - start).toFixed(3)}ms`
        );
        return false;
    },
}

module.exports = Tower;