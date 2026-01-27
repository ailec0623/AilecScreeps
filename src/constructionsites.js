// 使用新的任务发布器和内存管理器
const TaskReleaser = require('./task/TaskReleaser');
const MemoryManager = require('./core/MemoryManager');
const Constants = require('./config/Constants');

var ConstructionSite = {
    run: function(){
        for(let i in Game.constructionSites){
            var room = Game.constructionSites[i].room;
            if(room){
                // 从新内存路径检查任务数量
                const roomMemory = MemoryManager.getRoomMemory(room.name);
                if (!roomMemory || !roomMemory.localTasks) {
                    continue;
                }
                
                var haveTask = 0;
                if (roomMemory.localTasks.build) {
                    for (let t of roomMemory.localTasks.build) {
                        if (t.releaserId == Game.constructionSites[i].id) {
                            haveTask += 1;
                        }
                    }
                }
                
                if (haveTask > 2) {
                    continue;
                } else {
                    TaskReleaser.releaseTask(room, Constants.TASK_TYPES.BUILD, Game.constructionSites[i].pos, Game.constructionSites[i].pos, Game.constructionSites[i].id, 1, null);
                }
            }
        }
    }
}
module.exports = ConstructionSite;