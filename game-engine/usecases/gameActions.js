import Game from "../entities/game.js";
import { redis } from "../infrastructure/redis.js";

export async function createGame() {
    const game = new Game();
    await redis.set(`game:${game.id}`, JSON.stringify(game));
    await redis.lpush("games:waiting", game.id);
    return game.id;
}

export async function loadGame(gameId) {
    const gameData = await redis.get(`game:${gameId}`);
    if (!gameData) throw new Error(`Juego no encontrado: ${gameId}`);
    return Game.fromObject(JSON.parse(gameData));
}

export async function saveGame(gameId, game) {
    await redis.set(`game:${gameId}`, JSON.stringify(game));
}

export async function joinGame(playerId, gameId) {
    const game = await loadGame(gameId);
    game.addPlayer(playerId);
    await saveGame(gameId, game);
}

export async function playerStand(playerId, gameId) {
    const game = await loadGame(gameId);
    game.stand(playerId);
    await saveGame(gameId, game);
}

export async function playerHit(playerId, gameId) {
    const game = await loadGame(gameId);
    game.hit(playerId);
    await saveGame(gameId, game);
}

export async function leaveGame(playerId, gameId) {
    const game = await loadGame(gameId);
    game.removePlayer(playerId);
    if (game.playerCount === 0) {
        await redis.lrem("games:waiting", 0, gameId);
        await redis.del(`game:${gameId}`);
    } else {
        await saveGame(gameId, game);
    }
}

export async function playerReady(playerId, gameId) {
    const game = await loadGame(gameId);
    game.setPlayerReady(playerId);
    await saveGame(gameId, game);
}
