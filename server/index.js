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
const redisSub = new Cluster(redisNodes, {
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
redisSub.on("connect", () => {
    console.log("Connected to Redis Cluster subscriber");
});
redisSub.on("error", (err) => {
    console.error("Redis Cluster subscriber error:", err);
});
//

const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const clients = new Map(); // playerId => { ws, disconnectedAt }
const subscriptions = new Map(); // gameId => Set of playerIds
const RECONNECT_WINDOW = 30 * 1000; // 30 seconds
const HEARTBEAT_INTERVAL = 10 * 1000; // 10 seconds

async function enqueueTask({ action, playerId, gameId }) {
    const taskId = crypto.randomUUID();
    await redis.lpush(
        "blackjack:tasks",
        JSON.stringify({
            id: taskId,
            action,
            playerId,
            gameId,
        })
    );
    return taskId;
}

function subscribe(playerId, gameId) {
    if (!subscriptions.has(gameId)) {
        subscriptions.set(gameId, new Set());
    }
    subscriptions.get(gameId).add(playerId);
}

function unsubscribe(playerId, gameId) {
    const subscribers = subscriptions.get(gameId);
    if (subscribers) {
        subscribers.delete(playerId);
        if (subscribers.size === 0) {
            subscriptions.delete(gameId);
        }
    }
}

// Heartbeat to detect stale connections
function startHeartbeat(ws) {
    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));
}

setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        ws.ping();
    });
    // Clean up clients outside reconnect window
    for (const [playerId, client] of clients) {
        if (
            client.disconnectedAt &&
            now - client.disconnectedAt > RECONNECT_WINDOW
        ) {
            clients.delete(playerId);
            for (const [gameId, subscribers] of subscriptions) {
                if (subscribers.has(playerId)) {
                    unsubscribe(playerId, gameId);
                    enqueueTask({ action: "exit", playerId, gameId });
                }
            }
        }
    }
}, HEARTBEAT_INTERVAL);

function redactGameData(game) {
    const { players, turn, dealer, ...rest } = game;
    const redactedGame = {
        ...rest,
        deck: undefined, // Always remove deck
        players,
        turn,
    };

    if (dealer) {
        if (turn >= players.length) {
            // Show full dealer hand and score when turn >= players.length
            redactedGame.dealer = { ...dealer };
        } else {
            // Redact second card and score
            redactedGame.dealer = {
                hand:
                    dealer.hand && dealer.hand.length > 0
                        ? [dealer.hand[0], null]
                        : [],
                score: undefined,
            };
        }
    }

    return redactedGame;
}

// Subscribe to game-events channel
redisSub.subscribe("game-events", (err) => {
    if (err) {
        console.error("Failed to subscribe to game-events channel", err);
    } else {
        console.log("Subscribed to game-events channel");
    }
});

// Handle game events from setAndPublish
redisSub.on("message", async (channel, message) => {
    try {
        const event = JSON.parse(message);
        if (event.result === "success") {
            const playerId = event.playerId;
            const gameId = event.data.id;
            if (event.type === "host" || event.type === "join") {
                subscribe(playerId, gameId);
            }
            const subscribers = subscriptions.get(gameId);
            if (!subscribers) return;

            const redactedEvent = {
                ...event,
                data: redactGameData(event.data),
            };

            for (const subscriberId of subscribers) {
                const client = clients.get(subscriberId);
                if (client?.ws && client.ws.readyState === WebSocket.OPEN) {
                    console.log(
                        `Sending event to player ${subscriberId} for game ${gameId}`
                    );
                    client.ws.send(JSON.stringify(redactedEvent));
                }
            }
        } else {
            const playerId = event.playerId;
            const client = clients.get(playerId);
            if (client?.ws && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({ error: event }));
            }
        }
    } catch (e) {
        console.error("Failed to process game event", e);
    }
});

wss.on("connection", (ws) => {
    let playerId = null;

    startHeartbeat(ws);

    ws.on("message", async (msg) => {
        try {
            const data = JSON.parse(msg);

            const { action, gameId } = data;

            if (action === "register") {
                if (!data.playerId) {
                    ws.send(JSON.stringify({ error: "playerId required" }));
                    ws.close(1008, "playerId required");
                    return;
                }
                if (clients.has(data.playerId)) {
                    const existingClient = clients.get(data.playerId);
                    if (!existingClient.disconnectedAt) {
                        ws.send(
                            JSON.stringify({
                                error: "Player already registered",
                            })
                        );
                        return;
                    }
                    // Handle reconnection
                    const now = Date.now();
                    if (
                        now - existingClient.disconnectedAt <=
                        RECONNECT_WINDOW
                    ) {
                        console.log(`Player reconnected: ${data.playerId}`);
                    } else {
                        // Clean up stale data
                        clients.delete(data.playerId);
                        for (const [gId, subscribers] of subscriptions) {
                            if (subscribers.has(data.playerId)) {
                                unsubscribe(data.playerId, gId);
                                await enqueueTask({
                                    action: "exit",
                                    playerId: data.playerId,
                                    gameId: gId,
                                });
                            }
                        }
                    }
                }
                playerId = data.playerId;
                clients.set(playerId, { ws, disconnectedAt: null });
                console.log(`Player registered: ${playerId}`);
                ws.send(JSON.stringify({ success: true, playerId }));
                return;
            }

            console.log(
                `Received action: ${action} for player ${playerId} in game ${gameId}`
            );
            await enqueueTask({
                action,
                playerId,
                gameId,
            });
        } catch (err) {
            console.error("Error processing message:", err);
            ws.send(JSON.stringify({ error: "Invalid message format" }));
        }
    });

    ws.on("close", async () => {
        if (playerId) {
            console.log(`Player disconnected: ${playerId}`);
            clients.set(playerId, { ws: null, disconnectedAt: Date.now() });
        }
    });
});

wss.on("error", (err) => {
    console.error("WebSocket server error:", err);
});

console.log("WebSocket server running on port 8080");
