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
                Memory.mainRooms.push(Game.spawns[spawn].room.name);
                Memory.rooms[Game.spawns[spawn].room.name] = {};
                Memory.rooms[Game.spawns[spawn].room.name].extension = [];
                Memory.rooms[Game.spawns[spawn].room.name].centralLink = '';
                Memory.rooms[Game.spawns[spawn].room.name].wallHits = 100;
                this.initHarvesterPosition(Game.spawns[spawn].room);
            }
        }
    },
    
    upgradWall: function() {
        if(Game.time % 200 == 0){
            for (let room of Memory.mainRooms) {
                if(Game.rooms[room].storage && Game.rooms[room].storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 400000){
                    Memory.rooms[room].wallHits += 1000;
                }
            }
        }
    },

    initHarvesterPosition: function(room) {
        // Place a red flag for harvester
        let flagCounter = 0;
        var energySources = room.find(FIND_SOURCES_ACTIVE);
        for (var i in energySources) {
            var energySource = energySources[i];
            var x = energySource.pos.x;
            var y = energySource.pos.y;
            let area = room.lookAtArea(y-1, x-1, y+1, x+1, true);
            area = area.filter(item => item.x != x || item.y != y);
            area = area.filter(item => item.type == "terrain");
            area = area.filter(item => item.terrain != "wall");
            area.sort((a, b) => {
                return room.getPositionAt(a.x, a.y).getRangeTo(room.controller) <
                        room.getPositionAt(b.x, b.y).getRangeTo(room.controller);
            })
            if(area.length == 0){
                console.log(`Nearby position: ${x}, ${y}`);
                continue;
            }
            var flagPosition = room.getPositionAt(area[0].x, area[0].y);
            if(flagPosition.lookFor(LOOK_FLAGS).length == 0) {
                flagPosition.createFlag("HP" + flagCounter, COLOR_RED);
                flagCounter++;
            }
        }
    }
}

module.exports = tool;