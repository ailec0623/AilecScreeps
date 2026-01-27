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
                continue;
            }
            var flagPosition = room.getPositionAt(area[0].x, area[0].y);
            if(flagPosition.lookFor(LOOK_FLAGS).length == 0) {
                flagPosition.createFlag("HP" + flagCounter, COLOR_RED);
                flagCounter++;
            }
        }
    },

    initBuildingPosition: function(room, offset_x, offset_y) {
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
        var str = `aaabbbbbbbaaa\naabcccbdddbaa\nabccbcbdbddba\nbccbcbabdbdob\nbcbccbtbddbnb\nbbcctbqbtccbb\nbcccblafbcccb\nbbcctbrbtccbb\nbcbcsbtbscbcb\nbccbcbpbcbccb\nabccbcbcbccba\naabcccbcccbaa\naaabbbbbbbaaa`
        let x = 0;
        let y = 0;
        let flagCounter = 3;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === 'a') {
                x++;
                continue;
            }
            if (char === '\n') {
                y++;
                x = 0;
                continue;
            }
            var color = COLOR_WHITE;
            switch(char) {
                case "b": color = COLOR_RED; break;
                case "c": color = COLOR_PURPLE; break;
                case "d": color = COLOR_BLUE; break;
                case "s": color = COLOR_CYAN; break;
                case "o": color = COLOR_GREEN; break;
                case "t": color = COLOR_YELLOW; break;
                case "q": color = COLOR_ORANGE; break;
                case "l": color = COLOR_BROWN; break;
                case "f": color = COLOR_GREY; break;
                case "r": color = COLOR_WHITE; break;
                case "n": color = COLOR_YELLOW; break;
                case "p": color = COLOR_CYAN; break;
            }
            var flagPosition = room.getPositionAt(offset_x + x, offset_y + y);
            if (flagPosition.lookFor(LOOK_TERRAIN) === "wall") {
                x++;
                continue;
            }
            flagPosition.createFlag("B" + flagCounter, COLOR_BLUE, color);
            flagCounter++;
            x++;
        }
    }
}

module.exports = tool;