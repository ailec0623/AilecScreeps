var Task = require('task');
var buildingCount = require('structure.count');

var Room = {
    build: function(room) {
        var flags = room.find(FIND_FLAGS, {
            filter: (f) => {
                return f.color === COLOR_BLUE;
            }
        })
        if(flags.length == 0 && room.controller.level == 8){
            room.memory.autoBuild = false;
        }
        if(room.find(FIND_CONSTRUCTION_SITES).length == 0){
            for ( let b in room.memory.buildings) {
                if (room.memory.buildings[b] < buildingCount[b][room.controller.level - 1]) {
                    var central = room.getPositionAt(room.memory.firstSpawn.pos.x, room.memory.firstSpawn.pos.y);
                    var color = {
                        STRUCTURE_TOWER:COLOR_YELLOW,
                        STRUCTURE_ROAD: COLOR_RED,
                        STRUCTURE_EXTENSION: COLOR_PURPLE,
                        STRUCTURE_LINK: COLOR_BROWN,
                        STRUCTURE_FACTORY: COLOR_GREY,
                        STRUCTURE_LAB: COLOR_BLUE,
                        STRUCTURE_NUKER: COLOR_YELLOW,
                        STRUCTURE_OBSERVER: COLOR_GREEN,
                        STRUCTURE_POWER_SPAWN: COLOR_CYAN,
                        STRUCTURE_SPAWN: COLOR_CYAN,
                        STRUCTURE_STORAGE: COLOR_WHITE,
                        STRUCTURE_TERMINAL: COLOR_ORANGE
                    };
                    var structureType = {
                        STRUCTURE_TOWER:STRUCTURE_TOWER,
                        STRUCTURE_ROAD: STRUCTURE_ROAD,
                        STRUCTURE_EXTENSION: STRUCTURE_EXTENSION,
                        STRUCTURE_LINK: STRUCTURE_LINK,
                        STRUCTURE_FACTORY: STRUCTURE_FACTORY,
                        STRUCTURE_LAB: STRUCTURE_LAB,
                        STRUCTURE_NUKER: STRUCTURE_NUKER,
                        STRUCTURE_OBSERVER: STRUCTURE_OBSERVER,
                        STRUCTURE_POWER_SPAWN: STRUCTURE_POWER_SPAWN,
                        STRUCTURE_SPAWN: STRUCTURE_SPAWN,
                        STRUCTURE_STORAGE: STRUCTURE_STORAGE,
                        STRUCTURE_TERMINAL: STRUCTURE_TERMINAL
                    };
                    var flag = central.findClosestByRange(FIND_FLAGS, {
                        filter: function(flag) {
                            return flag.color === COLOR_BLUE && flag.secondaryColor === color[b];
                        }
                    });
                    flag.pos.createConstructionSite(structureType[b], "Spawn" + (Game.spawns.length + 1));
                    flag.remove();
                    room.memory.buildings[b]++;
                    break;
                }
            }
        }
    },
    mainRoom: function(room){
        if(room.memory.autoBuild){
            this.build(room);
        }
        Task.initTasks(room.name);
        Task.spawnTasks(room);
        // Task.repairTask(room);
        for(let i in room.memory.extension){
            this.extensionRoom(room.memory.extension[i]);
        }
        if(room.memory.claimRoom != ""){
            this.claimRoom(room, room.memory.claimRoom);
        }
        if(room.memory.destroy.length >= 1) {
            this.destroyRoom(room, room.memory.destroy[0]);
        }
        
    },
    claimRoom: function(mainRoom, roomName) {
        var o = mainRoom.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_OBSERVER }
        });
        if(o.length == 0){
            return;
        }
        o[0].observeRoom(roomName);
        try{
            if(Game.rooms[roomName].controller.my){
                mainRoom.memory.claim = "";
            }
        } catch {
            return;
        }
    },
    destroyRoom: function(mainRoom, roomName) {
        var o = mainRoom.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_OBSERVER }
        });
        if(o.length == 0){
            return;
        }
        o[0].observeRoom(roomName);
        try{
            var targets = Game.rooms[roomName].find(FIND_HOSTILE_STRUCTURES, {
                filter: function(object) {
                    return object.structureType != STRUCTURE_CONTROLLER;
                }
            });
        } catch {
            return;
        }

        if(targets.length == 0){
            mainRoom.memory.destroy = [];
        }
    },
    extensionRoom: function(room){
        Task.initTasks(room);
        if(!Game.rooms[room]){
            return;
        }
        Task.reserveTask(Game.rooms[room]);
        Task.guardTask(Game.rooms[room]);
        Task.repairTask(Game.rooms[room]);
    },

    powerRoom: function(room){
        var r = Game.rooms[room];
        if(r.find(FIND_STRUCTURE, {
            filter: (s) => {
                return s.structureType == STRUCTURE_POWERBANK;
            }
        })){
            r.memory.needAttack = true;
            return;
        }else{
            r.memory.needAttack = false;
        }
        if(r.find(FIND_DROPPED_RESOURCES, {
            filter: (resource) => {
                return resource.resourceType == RESOURCE_POWER;
            }
        })){
            r.memory.needCollect = true;
            return;
        }else{
            r.memory.needCollect = false;
        }
        Memory.PowerRoom == null;
    }
}

module.exports = Room;