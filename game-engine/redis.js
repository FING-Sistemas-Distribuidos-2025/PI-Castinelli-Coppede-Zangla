import Redis from "ioredis";

const config = {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
};

export const redis = new Redis(config);
export const redisBlocking = new Redis(config);
export const redisPublisher = new Redis(config);

redis.on("connect", () => console.log("Redis connected"));
redisBlocking.on("connect", () => console.log("Blocking Redis connected"));
redisPublisher.on("connect", () => console.log("Publisher Redis connected"));

[redis, redisBlocking, redisPublisher].forEach((client) =>
    client.on("error", (err) => console.error("Redis error:", err))
);
