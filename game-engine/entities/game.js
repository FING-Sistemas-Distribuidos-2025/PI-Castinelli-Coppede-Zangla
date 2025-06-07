import Player from "./player.js";
import Deck from "./deck.js";
import { v4 as uuidv4 } from "uuid";

export default class Game {
    constructor() {
        this.id = uuidv4();
        this.inProgress = false;
        this.players = [];
        this.createdAt = new Date().toISOString();
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

    get playerCount() {
        return this.players.length;
    }

    get allPlayersReady() {
        return this.players.length > 1 && this.players.every((p) => p.ready);
    }

    #start() {
        if (this.inProgress) {
            throw new Error(`Game is already in progress`);
        }
        if (this.playerCount < 2) {
            throw new Error(`Game requires at least 2 players to start`);
        }
        if (!this.allPlayersReady) {
            throw new Error(`Not all players are ready`);
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
        this.inProgress = true;
        this.turn = 0;
        this.updatedAt = new Date().toISOString();
    }

    #dealerPlay() {
        while (this.dealer.score < 17) {
            this.dealer.addCard(this.deck.draw());
        }
        this.inProgress = false;
    }

    #nextTurn() {
        if (this.turn === "dealer") {
            throw new Error(`It's the dealer's turn, not a player`);
        }
        this.turn++;
        if (this.turn >= this.players.length) {
            this.turn = "dealer";
            this.#dealerPlay();
        }
    }

    hasPlayer(playerId) {
        return this.players.some((player) => player.id === playerId);
    }

    addPlayer(playerId) {
        if (this.inProgress) {
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

    setPlayerReady(playerId) {
        if (this.inProgress) {
            throw new Error(`Game is already in progress`);
        }
        const player = this.players.find((p) => p.id === playerId);
        if (!player) throw new Error(`Player is not part of the game`);
        player.ready = true;
        this.updatedAt = new Date().toISOString();
        // Auto-start if all players are ready after setting ready
        if (this.allPlayersReady) {
            this.#start();
        }
    }

    removePlayer(playerId) {
        const playerIndex = this.players.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) {
            throw new Error(`Player is not part of the game`);
        }
        const player = this.players[playerIndex];
        if (this.inProgress) {
            if (!player.busted) {
                player.stand = true;
                player.left = true;
            }
        } else {
            this.players.splice(playerIndex, 1);
        }
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
            this.#nextTurn();
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
        this.#nextTurn();
    }
}
