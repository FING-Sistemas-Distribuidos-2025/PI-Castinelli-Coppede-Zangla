import { v4 as uuidv4 } from "uuid";
import redisClient from "../config/redisClient.js";
import logger from "../utils/logger.js";

const suits = ["♠", "♥", "♦", "♣"];
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
    "J",
    "Q",
    "K",
    "A",
];
const values = {
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    10: 10,
    J: 10,
    Q: 10,
    K: 10,
    A: [1, 11],
};

export const createDeck = () => {
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return shuffle(deck);
};

const shuffle = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

export const startGame = async () => {
    const sessionId = uuidv4();
    const deck = createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    const gameState = {
        playerHand,
        dealerHand,
        deck,
        status: "player_turn",
    };

    await redisClient.set(`game:${sessionId}`, JSON.stringify(gameState));

    logger.info(`Started new blackjack game: ${sessionId}`);
    return sessionId;
};

export const calculateHandValue = (hand) => {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
        total += values[card.rank];
        if (card.rank === "A") {
            aces += 1;
        }
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces -= 1;
    }

    return total;
};

export const isBust = (hand) => calculateHandValue(hand) > 21;

export const getGame = async (sessionId) => {
    const data = await redisClient.get(`game:${sessionId}`);
    if (!data) throw new Error("Game not found");
    return JSON.parse(data);
};

export const saveGame = async (sessionId, gameState) => {
    await redisClient.set(`game:${sessionId}`, JSON.stringify(gameState));
};

export const playerHit = async (sessionId) => {
    const game = await getGame(sessionId);
    if (game.status !== "player_turn") {
        throw new Error("It's not your turn");
    }
    if (isBust(game.playerHand)) {
        throw new Error("You are already bust");
    }
    if (game.deck.length === 0) {
        throw new Error("No cards left in the deck");
    }
    const card = game.deck.pop();
    game.playerHand.push(card);
    if (isBust(game.playerHand)) {
        game.status = "dealer_turn";
    }
    await saveGame(sessionId, game);
    logger.info(`Player hit: ${card.rank}${card.suit}`);
    return game;
};

export const playerStand = async (sessionId) => {
    const game = await getGame(sessionId);
    logger.info(game.status);
    if (game.status !== "player_turn") {
        throw new Error("It's not your turn");
    }
    game.status = "dealer_turn";
    while (calculateHandValue(game.dealerHand) < 17) {
        if (game.deck.length === 0) {
            throw new Error("No cards left in the deck");
        }
        const card = game.deck.pop();
        game.dealerHand.push(card);
    }
    const playerValue = calculateHandValue(game.playerHand);
    const dealerValue = calculateHandValue(game.dealerHand);
    if (isBust(game.dealerHand)) {
        game.result = "player_wins";
    } else if (playerValue > dealerValue) {
        game.result = "player_wins";
    } else if (playerValue < dealerValue) {
        game.result = "dealer_wins";
    } else {
        game.result = "draw";
    }
    game.status = "game_over";
    await saveGame(sessionId, game);
    return game;
};
