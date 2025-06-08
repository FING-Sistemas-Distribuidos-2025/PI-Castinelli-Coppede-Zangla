import Redis from "ioredis";

const startupNodes = [
  { host: "redis-cluster-0.redis-cluster-headless.default.svc.cluster.local", port: 6379 },
  { host: "redis-cluster-1.redis-cluster-headless.default.svc.cluster.local", port: 6379 },
  { host: "redis-cluster-2.redis-cluster-headless.default.svc.cluster.local", port: 6379 },
  { host: "redis-cluster-3.redis-cluster-headless.default.svc.cluster.local", port: 6379 },
  { host: "redis-cluster-4.redis-cluster-headless.default.svc.cluster.local", port: 6379 },
  { host: "redis-cluster-5.redis-cluster-headless.default.svc.cluster.local", port: 6379 }
];

export const redis = new Redis.Cluster(startupNodes, {
    redisOptions: {
        password: process.env.REDIS_PASSWORD || ""
    }
});

redis.on("connect", () => console.log("Redis Cluster connected"));
redis.on("error", (err) => console.error("Redis error:", err));
