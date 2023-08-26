var tool = require('tool');
var RoomControl = require('room');
var Task = require('task');
var Creeps = require('creeps');
var Structures = require('structures');
var Flags = require('flags');
var ConstructionSites = require('constructionsites');
var SpawnControl = require('spawn');
require('./mount')()

module.exports.loop = function () {
    // Memory.rooms['E41N24'].extension = ['E41N23','E41N25'];
    // Memory.rooms['E41N24'].centralLink = '625db20cf2bd2b39fefce3e5';
    // Memory.rooms['E41N24'].wallHits = 23000000;
    tool.run();
    for(let i in Memory.mainRooms){
        RoomControl.mainRoom(Game.rooms[Memory.mainRooms[i]]);
    }
    for(let i in Game.spawns){
        if(Memory.mainRooms.includes(Game.spawns[i].room.name)){
            try{
                SpawnControl.acceptTask(Game.spawns[i]);
            }catch(e){
                console.log(e.stack);
            }
        }
    }
    ConstructionSites.run();
    Flags.run();
    Structures.run();
    for(i in Game.rooms){
        Task.sortTasks(Game.rooms[i]);
    }
    Creeps.run();
    for(i in Game.rooms){
        try{
            Task.cancelTask(Game.rooms[i]);
        }catch{
            continue;
        } 
    }
}