import { createClient } from "redis";
import logger from "../utils/logger.js";

const redisClient = createClient();

redisClient.on("error", (err) => logger.error("Redis Client Error: " + err));
await redisClient.connect();

logger.info("Redis client connected");
export default redisClient;
