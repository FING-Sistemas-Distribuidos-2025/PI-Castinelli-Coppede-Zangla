import Game from "../entities/game.js";
import { Player, Dealer } from "../entities/player.js";
import Deck from "../entities/deck.js";
import { v4 as uuidv4 } from "uuid";

describe("Game", () => {
    let game;
    beforeEach(() => {
        game = new Game();
    });

    it("should initialize with correct properties", () => {
        expect(game.id).toBeDefined();
        expect(game.inProgress).toBe(false);
        expect(game.players).toEqual([]);
        expect(game.playerCount).toBe(0);
    });

    it("should add and remove players", () => {
        const pid = uuidv4();
        game.addPlayer(pid);
        expect(game.players.length).toBe(1);
        expect(game.hasPlayer(pid)).toBe(true);
        game.removePlayer(pid);
        expect(game.players.length).toBe(0);
    });

    it("should not allow duplicate players", () => {
        const pid = uuidv4();
        game.addPlayer(pid);
        expect(() => game.addPlayer(pid)).toThrow("Player already joined");
    });

    it("should not allow more than 8 players", () => {
        for (let i = 0; i < 8; i++) {
            if (i < 8) game.addPlayer(uuidv4());
        }
        expect(() => game.addPlayer(uuidv4())).toThrow("Game is full");
    });

    it("should not start with less than 2 players", () => {
        game.addPlayer(uuidv4());
        expect(() => game.setPlayerReady(game.players[0].id)).not.toThrow();
        // Should not start, so inProgress remains false
        expect(game.inProgress).toBe(false);
    });

    it("should start game and deal cards", () => {
        const p1 = uuidv4();
        const p2 = uuidv4();
        game.addPlayer(p1);
        game.addPlayer(p2);
        game.setPlayerReady(p1);
        game.setPlayerReady(p2);
        expect(game.inProgress).toBe(true);
        expect(game.deck).toBeInstanceOf(Deck);
        expect(game.dealer).toBeInstanceOf(Dealer);
        expect(game.players[0].hand.length).toBe(2);
        expect(game.dealer.hand.length).toBe(2);
    });

    it("should not allow player to hit out of turn", () => {
        const p1 = uuidv4();
        const p2 = uuidv4();
        game.addPlayer(p1);
        game.addPlayer(p2);
        game.setPlayerReady(p1);
        game.setPlayerReady(p2);
        expect(() => game.hit(p2)).toThrow("not the player's turn");
    });

    it("should allow player to stand", () => {
        const p1 = uuidv4();
        const p2 = uuidv4();
        game.addPlayer(p1);
        game.addPlayer(p2);
        game.setPlayerReady(p1);
        game.setPlayerReady(p2);
        game.stand(p1);
        expect(game.players[0].stand).toBe(true);
    });

    it("should let dealer play after last player stands", () => {
        const p1 = uuidv4();
        const p2 = uuidv4();
        game.addPlayer(p1);
        game.addPlayer(p2);
        game.setPlayerReady(p1);
        game.setPlayerReady(p2);
        game.stand(p1); // turn moves to p2
        game.stand(p2); // turn moves to dealer, dealer should play
        expect(game.inProgress).toBe(false);
        expect(game.dealer.score).toBeGreaterThanOrEqual(17);
    });
});
