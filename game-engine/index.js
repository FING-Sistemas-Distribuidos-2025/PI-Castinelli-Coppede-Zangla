// Redis Cluster configuration
const { Cluster } = require("ioredis");

// Parse Redis cluster nodes from environment variable (e.g., "redis-cluster-headless:6379")
const redisNodes = process.env.REDIS_CLUSTER_NODES.split(",").map((node) => {
    const [host, port] = node.split(":");
    return { host, port: parseInt(port) };
});

const redis = new Cluster(redisNodes, {
    redisOptions: {
        password: process.env.REDIS_PASSWORD,
    },
});
const redisPub = new Cluster(redisNodes, {
    redisOptions: {
        password: process.env.REDIS_PASSWORD,
    },
});

redis.on("connect", () => {
    console.log("Connected to Redis Cluster");
});
redis.on("error", (err) => {
    console.error("Redis Cluster error:", err);
});
redisPub.on("connect", () => {
    console.log("Connected to Redis Cluster publisher");
});
redisPub.on("error", (err) => {
    console.error("Redis Cluster publisher error:", err);
});
//

// Game
const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
const ranks = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "Jack",
    "Queen",
    "King",
    "Ace",
];

const deck = () =>
    ranks.flatMap((rank) => suits.map((suit) => ({ rank, suit })));

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function score(hand) {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
        if (card.rank === "Ace") {
            total += 11;
            aces++;
        } else if (["Jack", "Queen", "King"].includes(card.rank)) {
            total += 10;
        } else {
            total += parseInt(card.rank, 10);
        }
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return total;
}
//

const crypto = require("crypto");
const LOCK_PREFIX = "lock:game:";
const LOCK_TIMEOUT_MS = 5000; // lock expiration
const RETRY_DELAY_MS = 100; // wait between retries
const RETRY_TIMEOUT_MS = 3000; // max total retry time

async function acquireLock(redis, lockKey, token, timeoutMs) {
    return await redis.set(lockKey, token, "NX", "PX", timeoutMs);
}

async function releaseLock(redis, lockKey, token) {
    const luaScript = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
    return await redis.eval(luaScript, 1, lockKey, token);
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadAndLockGame(redis, gameId) {
    const lockKey = LOCK_PREFIX + gameId;
    const lockToken = crypto.randomUUID();
    const startTime = Date.now();

    while (Date.now() - startTime < RETRY_TIMEOUT_MS) {
        console.log(`Attempting to acquire lock for game ${gameId}...`);
        const lockAcquired = await acquireLock(
            redis,
            lockKey,
            lockToken,
            LOCK_TIMEOUT_MS
        );
        if (lockAcquired) {
            // Got the lock, load game data
            const gameDataStr = await redis.get(`game:${gameId}`);
            if (!gameDataStr) {
                // Release lock if no game found
                await releaseLock(redis, lockKey, lockToken);
                return null;
            }
            const gameData = JSON.parse(gameDataStr);

            return {
                game: gameData,
                release: () => releaseLock(redis, lockKey, lockToken),
            };
        }

        // Wait a bit and retry
        await sleep(RETRY_DELAY_MS);
    }

    // Timeout expired, could not get the lock
    return null;
}

async function setAndPublish(playerId, type, game) {
    const event = {
        type,
        result: "success",
        data: game,
        playerId,
    };

    const luaScript = `
    redis.call("SET", KEYS[1], ARGV[1])
    redis.call("PUBLISH", "game-events", ARGV[2])
    return 1
  `;

    const gameJson = JSON.stringify(game);
    const eventJson = JSON.stringify(event);

    await redis.eval(luaScript, 1, `game:${game.id}`, gameJson, eventJson);
    console.log(`Game ${type} event published for game`, game);
}

async function delAndPublish(game) {
    const event = {
        type: "deleted",
        data: game,
    };

    const luaScript = `
    redis.call("DEL", KEYS[1])
    redis.call("PUBLISH", "game-events", ARGV[1])
    return 1
  `;

    const eventJson = JSON.stringify(event);
    await redis.eval(luaScript, 1, `game:${game.id}`, eventJson);
    console.log(`Game deleted event published for game`, game);
}

async function publishFailure(playerId, gameId, type, reason) {
    await redisPub.publish(
        "game-events",
        JSON.stringify({
            type,
            result: "failed",
            reason,
        })
    );
    console.error(`Game ${type} failed:`, reason);
}

// Action handlers
async function host(playerId) {
    const setAndPublishHost = setAndPublish.bind(null, playerId, "host");
    const game = {
        id: crypto.randomUUID(),
        host: playerId,
        players: [{ id: playerId }],
        inProgress: false,
    };

    await setAndPublishHost(game);
}

async function join(playerId, gameId) {
    const setAndPublishJoin = setAndPublish.bind(null, playerId, "join");
    const publishJoinFailure = publishFailure.bind(
        null,
        playerId,
        gameId,
        "join"
    );

    const result = await loadAndLockGame(redis, gameId);
    if (!result) {
        await publishJoinFailure("game-not-found");
        return;
    }

    const { game, release } = result;

    try {
        if (game.inProgress) {
            await publishJoinFailure("game-in-progress");
            return;
        }

        if (game.players.some((p) => p.id === playerId)) {
            await publishJoinFailure("player-already-in-game");
            return;
        }

        if (game.players.length >= 8) {
            await publishJoinFailure("game-full");
            return;
        }

        game.players.push({ id: playerId });
        await setAndPublishJoin(game);
    } finally {
        await release();
    }
}

async function exit(playerId, gameId) {
    const setAndPublishExit = setAndPublish.bind(null, playerId, "exit");
    const publishExitFailure = publishFailure.bind(
        null,
        playerId,
        gameId,
        "exit"
    );

    const result = await loadAndLockGame(redis, gameId);
    if (!result) {
        await publishExitFailure("game-not-found");
        return;
    }

    const { game, release } = result;

    try {
        const playerIndex = game.players.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) {
            await publishExitFailure("player-not-in-game");
            return;
        }

        if (game.inProgress) {
            game.players[playerIndex].abandoned = true;
            game.players[playerIndex].busted = true; // Mark as busted if they exit during the game
        } else {
            game.players.splice(playerIndex, 1);

            if (game.players.length === 0) {
                await delAndPublish(game);
                return;
            }

            if (game.host === playerId) {
                game.host = game.players[0].id; // Assign new host
            }
        }

        await setAndPublishExit(game);
    } finally {
        await release();
    }
}

async function start(playerId, gameId) {
    const setAndPublishStart = setAndPublish.bind(null, playerId, "start");
    const publishStartFailure = publishFailure.bind(
        null,
        playerId,
        gameId,
        "start"
    );

    const result = await loadAndLockGame(redis, gameId);
    if (!result) {
        await publishStartFailure("game-not-found");
        return;
    }

    const { game, release } = result;

    try {
        if (game.inProgress) {
            await publishStartFailure("game-already-in-progress");
            return;
        }

        if (game.host !== playerId) {
            await publishStartFailure("not-game-host");
            return;
        }

        if (game.players.length < 2) {
            await publishStartFailure("not-enough-players");
            return;
        }

        game.inProgress = true;
        game.turn = 0; // Start with the first player
        game.deck = shuffle(deck());
        game.dealer = { hand: [], score: 0 };

        // Deal initial cards
        for (let i = 0; i < 2; i++) {
            for (const player of game.players) {
                player.hand ||= [];
                player.hand.push(game.deck.pop());
            }
            game.dealer.hand.push(game.deck.pop());
        }

        // Calculate initial scores
        for (const player of game.players) {
            player.score = score(player.hand);
        }
        game.dealer.score = score(game.dealer.hand);

        await setAndPublishStart(game);
    } finally {
        await release();
    }
}

function dealer(game) {
    while (game.dealer.score < 17) {
        game.dealer.hand.push(game.deck.pop());
        game.dealer.score = score(game.dealer.hand);
    }

    if (dealer.score > 21) {
        // Dealer busted, all non-busted players win
        for (const player of game.players) {
            if (!player.busted) {
                player.won = true;
            } else {
                player.lost = true;
            }
        }
    } else {
        // Determine winners
        for (const player of game.players) {
            if (!player.busted && player.score > game.dealer.score) {
                player.won = true;
            } else {
                player.lost = true;
            }
        }
    }
}

async function hit(playerId, gameId) {
    const setAndPublishHit = setAndPublish.bind(null, playerId, "hit");
    const publishHitFailure = publishFailure.bind(
        null,
        playerId,
        gameId,
        "hit"
    );

    const result = await loadAndLockGame(redis, gameId);
    if (!result) {
        await publishHitFailure("game-not-found");
        return;
    }

    const { game, release } = result;

    try {
        if (!game.inProgress) {
            await publishHitFailure("game-not-in-progress");
            return;
        }

        const currentPlayer = game.players[game.turn];
        if (currentPlayer.id !== playerId) {
            await publishHitFailure("not-your-turn");
            return;
        }

        if (currentPlayer.score >= 21) {
            await publishHitFailure("player-already-busted");
            return;
        }

        // Deal a card to the player
        currentPlayer.hand.push(game.deck.pop());
        currentPlayer.score = score(currentPlayer.hand);

        // Check for bust
        if (currentPlayer.score > 21) {
            // Player busted, end their turn
            currentPlayer.busted = true;
            // Advance turn until next non-busted player
            game.turn++;
            while (
                game.turn < game.players.length &&
                game.players[game.turn].busted
            ) {
                game.turn++;
            }

            if (game.turn >= game.players.length) {
                // Dealer's turn if all players have acted
                dealer(game);
            }
        }

        await setAndPublishHit(game);
    } finally {
        await release();
    }
}

async function stand(playerId, gameId) {
    const setAndPublishStand = setAndPublish.bind(null, playerId, "stand");
    const publishStandFailure = publishFailure.bind(
        null,
        playerId,
        gameId,
        "stand"
    );

    const result = await loadAndLockGame(redis, gameId);
    if (!result) {
        await publishStandFailure("game-not-found");
        return;
    }

    const { game, release } = result;

    try {
        if (!game.inProgress) {
            await publishStandFailure("game-not-in-progress");
            return;
        }

        const currentPlayer = game.players[game.turn];
        if (currentPlayer.id !== playerId) {
            await publishStandFailure("not-your-turn");
            return;
        }

        // advance to the next non-busted player
        currentPlayer.stood = true;
        game.turn++;
        while (
            game.turn < game.players.length &&
            game.players[game.turn].busted
        ) {
            game.turn++;
        }

        if (game.turn >= game.players.length) {
            // Dealer's turn if all players have acted
            dealer(game);
        }

        await setAndPublishStand(game);
    } finally {
        await release();
    }
}

async function reset(playerId, gameId) {
    const setAndPublishPlayAgain = setAndPublish.bind(null, playerId, "reset");
    const publishPlayAgainFailure = publishFailure.bind(
        null,
        playerId,
        gameId,
        "reset"
    );

    const result = await loadAndLockGame(redis, gameId);
    if (!result) {
        await publishPlayAgainFailure("game-not-found");
        return;
    }

    const { game, release } = result;

    try {
        if (!game.inProgress) {
            await publishPlayAgainFailure("game-not-in-progress");
            return;
        }

        if (game.host !== playerId) {
            await publishPlayAgainFailure("not-game-host");
            return;
        }

        if (game.turn < game.players.length) {
            await publishPlayAgainFailure("game-not-finished");
            return;
        }

        // Reset game state for a new round
        game.inProgress = false;
        delete game.turn;
        delete game.deck;
        delete game.dealer;

        game.players = game.players
            .filter((player) => !player.abandoned)
            .map((player) => {
                const { hand, score, busted, stood, won, lost, ...rest } =
                    player;
                return rest;
            });

        await setAndPublishPlayAgain(game);
    } finally {
        await release();
    }
}

async function main() {
    console.log("Game engine started");
    while (true) {
        const task = await redis.brpop("blackjack:tasks", 0);
        if (!task) continue;

        const { action, playerId, gameId } = JSON.parse(task[1]);

        switch (action) {
            case "host":
                await host(playerId);
                break;
            case "join":
                await join(playerId, gameId);
                break;
            case "exit":
                await exit(playerId, gameId);
                break;
            case "start":
                await start(playerId, gameId);
                break;
            case "hit":
                await hit(playerId, gameId);
                break;
            case "stand":
                await stand(playerId, gameId);
                break;
            case "reset":
                await reset(playerId, gameId);
                break;
            default:
                console.error(`Unknown action: ${action}`);
        }
    }
}

main().catch((err) => {
    console.error("Error in main loop:", err);
    // Continue processing tasks
    main();
});
