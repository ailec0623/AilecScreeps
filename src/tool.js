var tool = {
    run: function () {
        this.initGame();
        this.getPixels();
        this.cleanCreeps();
        this.upgradWall();
    },
    getPixels: function () {
        if (Game.cpu.bucket == 10000) {
            Game.cpu.generatePixel();
        }
    },

    cleanCreeps: function () {
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }

    },
    
    initGame: function () {
        if (!Memory.mainRooms) {
            Memory.mainRooms = [];
        }
        for ( let spawn in Game.spawns) {
            if (!Memory.mainRooms.includes(Game.spawns[spawn].room.name)) {
                var room = Game.spawns[spawn].room;
                Memory.mainRooms.push(room.name);
                Memory.rooms[room.name] = {};
                Memory.rooms[room.name].firstSpawn = {pos: {x: Game.spawns[spawn].pos.x, y: Game.spawns[spawn].pos.y}};
                Memory.rooms[room.name].extension = [];
                Memory.rooms[room.name].destroy = [];
                Memory.rooms[room.name].claimRoom = [];
                Memory.rooms[room.name].centralLink = '';
                Memory.rooms[room.name].wallHits = 100;
                Memory.rooms[room.name].autoBuild = true;
                this.initHarvesterPosition(room);
                this.initBuildingPosition(room, Game.spawns[spawn].pos.x - 6, Game.spawns[spawn].pos.y - 3);
            }
        }
    },
    
    upgradWall: function() {
        if(Game.time % 20 == 0){
            for (let room of Memory.mainRooms) {
                if(Game.rooms[room].storage && Game.rooms[room].storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 400000){
                    Memory.rooms[room].wallHits += 1000;
                }
            }
        }
    },

    initHarvesterPosition: function(room) {
        // 不再自动创建harvester flag，使用TaskGenerator自动生成任务
        // 如果需要手动创建flag，可以保留此方法但注释掉自动创建逻辑
        return;
    },

    initBuildingPosition: function(room, offset_x, offset_y) {
        // 初始化建筑计数，但不自动创建flag
        // flag应该手动创建，或者由RoomPlanner自动规划
        room.memory.buildings = {
            STRUCTURE_TOWER: 0,
            STRUCTURE_ROAD: 0,
            STRUCTURE_EXTENSION: 0,
            STRUCTURE_LINK: 0,
            STRUCTURE_FACTORY: 0,
            STRUCTURE_LAB: 0,
            STRUCTURE_NUKER: 0,
            STRUCTURE_OBSERVER: 0,
            STRUCTURE_POWER_SPAWN: 0,
            STRUCTURE_SPAWN: 1,
            STRUCTURE_STORAGE: 0,
            STRUCTURE_TERMINAL: 0
        };
        // 不再自动创建建筑flag
        // 如果需要手动创建flag，可以保留此方法但注释掉自动创建逻辑
        return;
    }
}

module.exports = tool;