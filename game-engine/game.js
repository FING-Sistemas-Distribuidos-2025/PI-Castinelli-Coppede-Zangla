import Player from "./player.js";
import Deck from "./deck.js";
import { v4 as uuidv4 } from "uuid";

export default class Game {
    constructor() {
        this.id = uuidv4();
        this.status = "waiting";
        this.players = [];
        this.createdAt = new Date().toISOString();
    }

    get playerCount() {
        return this.players.length;
    }

    static fromObject(obj) {
        const game = Object.assign(new Game(), obj);
        game.players = obj.players.map((p) => Object.assign(new Player(), p));

        if (obj.deck) {
            game.deck = Object.assign(new Deck(), obj.deck);
        }

        if (obj.dealer) {
            game.dealer = Object.assign(new Player(obj.dealer.id), obj.dealer);
        }

        return game;
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

    removePlayer(playerId) {
        const playerIndex = this.players.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) {
            throw new Error(`Player is not part of the game`);
        }
        const player = this.players[playerIndex];
        if (this.status === "in_progress") {
            if (!player.busted) {
                player.stand = true;
                player.left = true;
            }
        } else {
            this.players.splice(playerIndex, 1);
        }
        this.updatedAt = new Date().toISOString();
    }

    start() {
        if (this.status === "in_progress") {
            throw new Error(`Game is already in progress`);
        }
        if (this.playerCount < 2) {
            throw new Error(`Game requires at least 2 players to start`);
        }
        this.deck = new Deck();
        this.deck.shuffle();
        this.dealer = new Player("dealer");
        this.players.forEach((player) => {
            player.reset();
        });
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

    hit(playerId) {
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
        if (player.busted) {
            this.nextTurn();
        }
    }

    dealerPlay() {
        while (this.dealer.score < 17) {
            this.dealer.addCard(deck.draw());
        }
        this.status = "finished";
    }

    nextTurn() {
        if (this.turn === "dealer") {
            throw new Error(`It's the dealer's turn, not a player`);
        }
        this.turn++;
        if (this.turn >= this.players.length) {
            this.turn = "dealer";
            this.dealerPlay();
        }
    }

    stand(playerId) {
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
        this.nextTurn();
    }

    reset() {
        if (this.status !== "finished") {
            throw new Error("Game can only be reset after it has finished");
        } else {
            this.status = "waiting";
            this.players.forEach((player) => player.reset());
            this.deck = undefined;
            this.dealer = undefined;
            this.turn = undefined;
            this.updatedAt = new Date().toISOString();
        }
    }
}
