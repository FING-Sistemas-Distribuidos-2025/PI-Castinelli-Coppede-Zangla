import express from "express";
import morgan from "morgan";
import logger from "./utils/logger.js";
import users from "./routes/users.js";
import blackjack from "./routes/blackjack.js";

const app = express();

app.use(express.json());
app.use(morgan("dev"));

app.use('/api/users', users);
app.use('/api/blackjack', blackjack);

app.use((err, req, res, next) => {
    logger.error(err.message);
    res.status(500).json({ error: "Internal Server Error" });
});

export default app;