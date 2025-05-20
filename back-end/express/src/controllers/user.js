import { getAll } from "../services/user.js";
import logger from "../utils/logger.js";

export const index = async (req, res) => {
    try {
        const users = await getAll();
        logger.info(`Fetched ${users.length} users`);
        res.json(users);
    } catch (err) {
        next(err);
    }
};