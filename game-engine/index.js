import { redis, redisBlocking, redisPublisher } from "./redis.js";
import Game from "./game.js";

const QUEUE_KEY = "queue:tasks";
const WAITING_KEY = "games:waiting";

async function main() {
    while (true) {
        try {
            // brpop returns [queueName, taskString]
            const taskData = await redisBlocking.brpop(QUEUE_KEY, 0);
            const task = JSON.parse(taskData[1]);
            if (!task.id) {
                throw new Error("Invalid task");
            }
            console.log("task", task);
            execute(task).catch((err) => {
                console.error(`Error executing task ${task.id}:`, err);
                task.status = "error";
                redis.set(`task:${task.id}`, JSON.stringify(task));
                redisPublisher.publish("task:completed", JSON.stringify(task));
            });
        } catch (err) {
            console.error(err);
        }
    }
}

async function execute(task) {
    switch (task.action) {
        case "create":
            task.gameId = await createGame(task.playerId);
            break;
        case "join":
            await joinGame(task.playerId, task.gameId);
            break;
        case "start":
            await startGame(task.gameId);
            break;
        case "stand":
            await playerStand(task.playerId, task.gameId);
            break;
        case "leave":
            await leaveGame(task.playerId, task.gameId);
            break;
        case "hit":
            await playerHit(task.playerId, task.gameId);
            break;
        case "reset":
            await resetGame(task.gameId);
            break;
        default:
            task.status = "error";
            console.error(`Unknown action: ${task.action}`);
    }
    task.status ||= "success";
    await redis.set(`task:${task.id}`, JSON.stringify(task));
    await redisPublisher.publish("task:completed", JSON.stringify(task));
    console.log("Task executed:", task);
    return task;
}

async function createGame() {
    const game = new Game();
    await redis.set(`game:${game.id}`, JSON.stringify(game));
    await redis.lpush(WAITING_KEY, game.id);
    return game.id;
}

export async function loadGame(gameId) {
    const gameData = await redis.get(`game:${gameId}`);
    if (!gameData) throw new Error(`Game ${gameId} not found`);
    const game = JSON.parse(gameData);
    return Game.fromObject(game);
}

async function joinGame(playerId, gameId) {
    const game = await loadGame(gameId);
    game.addPlayer(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

async function startGame(gameId) {
    const game = await loadGame(gameId);
    game.start();
    await redis.set(`game:${gameId}`, JSON.stringify(game));
    await redis.lrem(WAITING_KEY, 0, gameId);
}

async function playerStand(playerId, gameId) {
    const game = await loadGame(gameId);
    game.playerStand(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

async function leaveGame(playerId, gameId) {
    const game = await loadGame(gameId);
    game.removePlayer(playerId);
    if (game.playerCount === 0) {
        await redis.lrem(WAITING_KEY, 0, gameId);
        await redis.del(`game:${gameId}`);
    } else {
        await redis.set(`game:${gameId}`, JSON.stringify(game));
    }
}

async function playerHit(playerId, gameId) {
    const game = await loadGame(gameId);
    game.hit(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

async function resetGame(gameId) {
    const game = await loadGame(gameId);
    game.reset();
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

main();
