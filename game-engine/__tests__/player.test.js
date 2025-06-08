import { Player } from "../entities/player.js";

describe("Player", () => {
    it("should initialize with correct properties", () => {
        const player = new Player("p1");
        expect(player.id).toBe("p1");
        expect(player.hand).toEqual([]);
        expect(player.stand).toBe(false);
    });

    it("should calculate score correctly without aces", () => {
        const player = new Player("p2");
        player.hand = [
            { suit: "Hearts", rank: "10" },
            { suit: "Spades", rank: "9" },
        ];
        expect(player.score).toBe(19);
        expect(player.busted).toBe(false);
    });

    it("should calculate score correctly with aces", () => {
        const player = new Player("p3");
        player.hand = [
            { suit: "Hearts", rank: "Ace" },
            { suit: "Spades", rank: "9" },
        ];
        expect(player.score).toBe(20);
        player.hand.push({ suit: "Clubs", rank: "5" });
        expect(player.score).toBe(15);
    });

    it("should detect busted", () => {
        const player = new Player("p4");
        player.hand = [
            { suit: "Hearts", rank: "King" },
            { suit: "Spades", rank: "Queen" },
            { suit: "Clubs", rank: "2" },
        ];
        expect(player.busted).toBe(true);
    });

    it("should add cards and reset", () => {
        const player = new Player("p5");
        player.addCard({ suit: "Hearts", rank: "2" });
        expect(player.hand.length).toBe(1);
        player.reset();
        expect(player.hand).toEqual([]);
        expect(player.stand).toBe(false);
    });
});
