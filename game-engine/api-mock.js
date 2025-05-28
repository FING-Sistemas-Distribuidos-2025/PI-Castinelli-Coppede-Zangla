const { v4: uuidv4 } = require("uuid");
const Redis = require("ioredis");

const redis = new Redis();

const actions = [
    "create",
    "join",
    "hit",
    "stand",
    "leave",
    "start",
    "reset",
    "dealerPlay",
];
const mockPlayerIds = ["p1", "p2", "p3", "p4"];
const mockGameIds = ["g1", "g2", "g3"];

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function enqueueTask(action, payload = {}) {
    const task = {
        id: uuidv4(),
        action,
        timestamp: new Date().toISOString(),
        ...payload,
    };
    await redis.lpush("queue:tasks", JSON.stringify(task));
    return task;
}
async function enqueueLoop() {
    while (true) {
        const action = randomChoice(actions);

        const task = {
            id: uuidv4(),
            action,
            timestamp: new Date().toISOString(),
        };

        // Add mock playerId/gameId depending on action type
        if (["create"].includes(action)) {
            task.playerId = randomChoice(mockPlayerIds);
        } else if (
            ["join", "hit", "stand", "leave", "start"].includes(action)
        ) {
            task.playerId = randomChoice(mockPlayerIds);
            task.gameId = randomChoice(mockGameIds);
        } else if (["reset", "dealerPlay"].includes(action)) {
            task.gameId = randomChoice(mockGameIds);
        }

        await redis.lpush("queue:tasks", JSON.stringify(task));
        console.log("Enqueued task:", task);

        await new Promise((r) => setTimeout(r, 1000)); // 1 second delay
    }
}

enqueueLoop().catch(console.error);
