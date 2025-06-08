import { redis } from "./infrastructure/redis.js";
import {
    createGame,
    joinGame,
    playerStand,
    playerHit,
    leaveGame,
    playerReady
} from "./usecases/gameActions.js";

const QUEUE_KEY = "queue:tasks";

async function storeAndPublishTask(task) {
    await redis.set(`task:${task.id}`, JSON.stringify(task));
    await redis.publish(`task:completed:${task.id}`, JSON.stringify(task));
}

async function main() {
    while (true) {
        try {
            const taskData = await redis.brpop(QUEUE_KEY, 0);
            const task = JSON.parse(taskData[1]);
            if (task && task.id) {
                try {
                    await execute(task);
                } catch (err) {
                    console.error(err.message);
                    task.status = "error";
                    task.error = err.message;
                    task.completedAt = new Date().toISOString();
                    await storeAndPublishTask(task);
                }
            }
        } catch (err) {
            console.error("Error at main", err.message);
        }
    }
}

async function execute(task) {
    switch (task.action) {
        case "create":
            task.gameId = await createGame();
            break;
        case "join":
            validateFields(task, ["playerId", "gameId"]);
            await joinGame(task.playerId, task.gameId);
            break;
        case "ready":
            validateFields(task, ["playerId", "gameId"]);
            await playerReady(task.playerId, task.gameId);
            break;
        case "stand":
            validateFields(task, ["playerId", "gameId"]);
            await playerStand(task.playerId, task.gameId);
            break;
        case "leave":
            validateFields(task, ["playerId", "gameId"]);
            await leaveGame(task.playerId, task.gameId);
            break;
        case "hit":
            validateFields(task, ["playerId", "gameId"]);
            await playerHit(task.playerId, task.gameId);
            break;
        default:
            throw new Error(`Acción desconocida: ${task.action}`);
    }
    task.status = "success";
    task.completedAt = new Date().toISOString();
    await storeAndPublishTask(task);
    console.log("Tarea completada:", task.id, "| Acción:", task.action);
}

function validateFields(task, fields) {
    for (const field of fields) {
        if (!task[field]) {
            throw new Error(`Campo obligatorio faltante: ${field}`);
        }
    }
}

main();
