const Redis = require("ioredis");
const { v4: uuidv4 } = require("uuid");

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
});

redis.on("connect", () => {
    console.log("Connected to Redis");
});

redis.on("error", (err) => {
    console.error("Redis error:", err);
});

const processQueue = async () => {
    console.log("Game engine worker started, waiting for tasks...");
    while (true) {
        try {
            // brpop returns [queueName, taskString]
            const result = await redis.brpop("queue:tasks", 0);
            const task = JSON.parse(result[1]);

            if (!task || !task.id) {
                console.error("Invalid task data:", task);
                continue;
            }

            processTask(task);
        } catch (err) {
            console.error("Worker error:", err);
        }
    }
};

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

class Deck {
    constructor() {
        this.cards = [];
        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push({ suit, rank });
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        if (this.cards.length === 0) {
            throw new Error("No cards left in the deck");
        }
        return this.cards.pop();
    }
}

class Player {
    constructor(id) {
        this.id = id;
        this.hand = [];
        this.stand = false;
    }

    get busted() {
        return this.score > 21;
    }

    get score() {
        let score = 0;
        let aces = 0;
        for (const card of this.hand) {
            if (card.rank === "Ace") {
                score += 11;
                aces += 1;
            } else if (["Jack", "Queen", "King"].includes(card.rank)) {
                score += 10;
            } else {
                score += parseInt(card.rank, 10);
            }
        }
        while (score > 21 && aces > 0) {
            score -= 10;
            aces -= 1;
        }
        return score;
    }

    addCard(card) {
        this.hand.push(card);
    }

    reset() {
        this.hand = [];
        this.stand = false;
    }
}

class Game {
    constructor(id, hostPlayerId) {
        this.id = id;
        this.status = "waiting";
        this.hostPlayerId = hostPlayerId;
        this.players = [new Player(hostPlayerId)];
        this.createdAt = new Date().toISOString();
        this.updatedAt = this.createdAt;
    }

    static fromObject(obj) {
        const game = Object.assign(new Game(obj.id, obj.hostPlayerId), obj);
        game.players = obj.players.map((p) =>
            Object.assign(new Player(p.id), p)
        );

        if (obj.deck) {
            game.deck = Object.assign(new Deck(), obj.deck);
        }

        if (obj.dealer) {
            game.dealer = Object.assign(new Player(obj.dealer.id), obj.dealer);
        }

        return game;
    }

    get playerCount() {
        return this.players.length;
    }

    hasPlayer(playerId) {
        return this.players.some((player) => player.id === playerId);
    }

    addPlayer(playerId) {
        if (this.status !== "waiting") {
            throw new Error(`Game is not joinable`);
        }
        if (this.hasPlayer(playerId)) {
            throw new Error(`Player already joined`);
        }
        if (this.playerCount > 7) {
            throw new Error(`Game is full, cannot join`);
        }
        this.players.push(new Player(playerId));
        this.updatedAt = new Date().toISOString();
    }

    dealerPlay() {
        if (this.turn !== -1) {
            throw new Error(`It is not the dealer's turn`);
        }
        while (this.dealer.score < 17) {
            this.updatedAt = new Date().toISOString();
            this.dealer.addCard(this.deck.draw());
        }
        this.dealer.stand = true;
        this.status = "finished";
        this.updatedAt = new Date().toISOString();
    }

    start() {
        if (this.status === "in_progress") {
            throw new Error(`Game already started`);
        }
        if (this.playerCount < 2) {
            throw new Error(`Game requires at least 2 players to start`);
        }
        this.deck = new Deck();
        this.deck.shuffle();
        this.dealer = new Player("dealer");
        for (let i = 0; i < 2; i++) {
            this.players.forEach((player) => {
                player.addCard(this.deck.draw());
            });
            this.dealer.addCard(this.deck.draw());
        }
        this.status = "in_progress";
        this.turn = 0;
        this.updatedAt = new Date().toISOString();
    }

    playerStand(playerId) {
        const player = this.players.find((p) => p.id === playerId);
        if (!player) {
            throw new Error(`Player is not in game`);
        }
        if (player.stand) {
            throw new Error(`Player has already stood`);
        }
        if (player.busted) {
            throw new Error(`Player has already busted`);
        }
        player.stand = true;
        this.turn++;
        if (this.turn >= this.players.length) {
            this.turn = -1; // Dealer's turn
        }
        this.updatedAt = new Date().toISOString();
    }

    removePlayer(playerId) {
        const playerIndex = this.players.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) {
            throw new Error(`Player is not part of the game`);
        }
        this.players.splice(playerIndex, 1);
        this.updatedAt = new Date().toISOString();
        if (this.players.length === 0) {
            this.status = "finished";
        }
    }

    playerHit(playerId) {
        const playerIndex = this.players.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) {
            throw new Error(`Player is not in game`);
        }
        if (this.turn !== playerIndex) {
            throw new Error(`It is not the player's turn`);
        }
        const player = this.players[playerIndex];
        if (player.stand) {
            throw new Error(`Player has already stood`);
        }
        if (player.busted) {
            throw new Error(`Player has already busted`);
        }
        player.addCard(this.deck.draw());
        this.updatedAt = new Date().toISOString();
    }

    reset() {
        this.status = "waiting";
        this.players.forEach((player) => player.reset());
        this.deck = undefined;
        this.dealer = undefined;
        this.turn = undefined;
        this.updatedAt = new Date().toISOString();
    }
}

const loadGame = async (gameId) => {
    const gameData = JSON.parse(await redis.get(`game:${gameId}`));
    if (!gameData) throw new Error(`Game ${gameId} not found`);
    return Game.fromObject(gameData);
};

const createGame = async (playerId) => {
    const game = new Game(uuidv4(), playerId);
    await redis.set(`game:${game.id}`, JSON.stringify(game));
    return game.id;
};

const joinGame = async (playerId, gameId) => {
    const game = await loadGame(gameId);
    game.addPlayer(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
};

const startGame = async (playerId, gameId) => {
    const game = await loadGame(gameId);
    if (game.hostPlayerId !== playerId) {
        throw new Error(`Only the host player can start the game`);
    }
    game.start();
    await redis.set(`game:${gameId}`, JSON.stringify(game));
};

const playerStand = async (playerId, gameId) => {
    const game = await loadGame(gameId);
    game.playerStand(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
};

const leaveGame = async (playerId, gameId) => {
    const game = await loadGame(gameId);
    game.removePlayer(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
};

const playerHit = async (playerId, gameId) => {
    const game = await loadGame(gameId);
    game.playerHit(playerId);
    await redis.set(`game:${gameId}`, JSON.stringify(game));
};

const dealerPlay = async (gameId) => {
    const game = await loadGame(gameId);
    game.dealerPlay();
    await redis.set(`game:${gameId}`, JSON.stringify(game));
};

const resetGame = async (gameId) => {
    const game = await loadGame(gameId);
    game.reset();
    await redis.set(`game:${gameId}`, JSON.stringify(game));
};

const processTask = async (task) => {
    try {
        switch (task.action) {
            case "create":
                console.log(`Handling ${task.action} task`);
                if (!task.playerId) {
                    throw new Error("Player ID is required");
                }
                const gameId = await createGame(task.playerId);
                task.status = "completed";
                task.gameId = gameId;
                break;
            case "join":
                console.log(`Handling ${task.action} task`);
                if (!task.playerId) {
                    throw new Error("Player ID is required");
                }
                if (!task.gameId) {
                    throw new Error("Game ID is required");
                }
                await joinGame(task.playerId, task.gameId);
                task.status = "completed";
                break;
            case "start":
                console.log(`Handling ${task.action} task`);
                if (!task.playerId) {
                    throw new Error("Player ID is required");
                }
                if (!task.gameId) {
                    throw new Error("Game ID is required");
                }
                await startGame(task.playerId, task.gameId);
                task.status = "completed";
                break;
            case "stand":
                console.log(`Handling ${task.action} task`);
                if (!task.playerId) {
                    throw new Error("Player ID is required");
                }
                if (!task.gameId) {
                    throw new Error("Game ID is required");
                }
                await playerStand(task.playerId, task.gameId);
                task.status = "completed";
                break;
            case "leave":
                console.log(`Handling ${task.action} task`);
                if (!task.playerId) {
                    throw new Error("Player ID is required");
                }
                if (!task.gameId) {
                    throw new Error("Game ID is required");
                }
                await leaveGame(task.playerId, task.gameId);
                task.status = "completed";
                break;
            case "hit":
                console.log(`Handling ${task.action} task`);
                if (!task.playerId) {
                    throw new Error("Player ID is required");
                }
                if (!task.gameId) {
                    throw new Error("Game ID is required");
                }
                await playerHit(task.playerId, task.gameId);
                task.status = "completed";
                break;
            case "dealerPlay":
                console.log(`Handling ${task.action} task`);
                if (!task.gameId) {
                    throw new Error("Game ID is required");
                }
                await dealerPlay(task.gameId);
                task.status = "completed";
                break;
            case "reset":
                console.log(`Handling ${task.action} task`);
                if (!task.gameId) {
                    throw new Error("Game ID is required");
                }
                await resetGame(task.gameId);
                task.status = "completed";
                break;
            default:
                console.log(`Unknown action: ${task.action}`);
                task.status = "error";
                task.message = `Unknown action: ${task.action}`;
                break;
        }
        await redis.set(`task:${task.id}`, JSON.stringify(task));
        await redis.publish("task:completed", JSON.stringify(task));
        console.log(`Task ${task.id} done.`);
    } catch (err) {
        console.error(`Error processing task ${task?.id}:`, err);
        await redis.set(
            `task:${task.id}`,
            JSON.stringify({
                ...task,
                status: "error",
                message: err.message,
            })
        );
    }
};

processQueue();
