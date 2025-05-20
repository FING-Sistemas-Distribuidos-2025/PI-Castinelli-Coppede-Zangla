import {
    startGame,
    playerHit,
    playerStand,
    getGame,
} from "../services/blackjack.js";
import logger from "../utils/logger.js";

export const start = async (req, res, next) => {
    try {
        const sessionId = await startGame();
        res.json({ sessionId });
    } catch (err) {
        next(err);
    }
};

export const hit = async (req, res, next) => {
    try {
        const game = await playerHit(req.params.sessionId);
        logger.info(game);
        const redacted = redact(game);
        res.json(redacted);
    } catch (err) {
        logger.error(err);
        next(err);
    }
};

export const stand = async (req, res, next) => {
    try {
        const game = await playerStand(req.params.sessionId);
        res.json(game);
    } catch (err) {
        next(err);
    }
};

export const show = async (req, res, next) => {
    try {
        const game = await getGame(req.params.sessionId);
        logger.info(game);
        const redacted = redact(game);
        res.json(redacted);
    } catch (err) {
        next(err);
    }
};

const redact = (game) => {
    const { playerHand, dealerHand } = game;
    return {
        playerHand,
        dealerHand: [dealerHand[0], { suit: "?", rank: "?" }],
    };
};
