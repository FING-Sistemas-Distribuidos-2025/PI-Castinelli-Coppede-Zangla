import { v4 as uuidv4 } from "uuid";
import { redis, redisBlocking, redisPublisher } from "./redis.js";
import Game from "./game.js";

const QUEUE_KEY = "queue:tasks";

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
            execute(task);
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
            await startGame(task.playerId, task.gameId);
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
        case "dealerPlay":
            await dealerPlay(task.gameId);
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

async function loadGame(gameId) {
    const gameData = JSON.parse(await redis.get(`game:${gameId}`));
    if (!gameData) throw new Error(`Game ${gameId} not found`);
    return Game.fromObject(gameData);
}

async function createGame(playerId) {
    const game = new Game(uuidv4(), playerId);
    await redis.set(`game:${game.id}`, JSON.stringify(game));
    return game.id;
}

async function joinGame(playerId, gameId) {
    const game = await loadGame(gameId);
    game.addPlayer(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

async function startGame(playerId, gameId) {
    const game = await loadGame(gameId);
    if (game.hostPlayerId !== playerId) {
        throw new Error(`Only the host player can start the game`);
    }
    game.start();
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

async function playerStand(playerId, gameId) {
    const game = await loadGame(gameId);
    game.playerStand(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

async function leaveGame(playerId, gameId) {
    const game = await loadGame(gameId);
    game.removePlayer(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

async function playerHit(playerId, gameId) {
    const game = await loadGame(gameId);
    game.playerHit(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

async function dealerPlay(gameId) {
    const game = await loadGame(gameId);
    game.dealerPlay();
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

async function resetGame(gameId) {
    const game = await loadGame(gameId);
    game.reset();
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

main();
