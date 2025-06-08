import Redis from "ioredis";

const startupNodes = [
    { host: process.env.REDIS_HOST || "localhost", port: parseInt(process.env.REDIS_PORT || 6379) }
];

export const redis = new Redis.Cluster(startupNodes);

redis.on("connect", () => console.log("Redis Cluster connected"));
redis.on("error", (err) => console.error("Redis error:", err));
