var tool = {
    run: function () {
        this.initGame();
        this.getPixels();
        this.cleanCreeps();
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
                Memory.mainRooms.push(Game.spawns[spawn].room.name);
                Memory.rooms[Game.spawns[spawn].room.name].extension = [];
                Memory.rooms[Game.spawns[spawn].room.name].centralLink = '';
                Memory.rooms[Game.spawns[spawn].room.name].wallHits = 100;
            }
        }
    },
    
    upgradWall: function() {
        if(Game.time % 200 == 0){
            for (room in Memory.mainRooms) {
                if(Game.rooms[room].storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 400000){
                    Memory.rooms[room].wallHits += 1000;
                }
            }
        }
    }
}

module.exports = tool;