import Deck from "../entities/deck.js";

describe("Deck", () => {
    it("should initialize with 52 cards", () => {
        const deck = new Deck();
        expect(deck.cards.length).toBe(52);
    });

    it("should draw a card and reduce deck size", () => {
        const deck = new Deck();
        const card = deck.draw();
        expect(card).toHaveProperty("suit");
        expect(card).toHaveProperty("rank");
        expect(deck.cards.length).toBe(51);
    });

    it("should throw error when drawing from empty deck", () => {
        const deck = new Deck();
        for (let i = 0; i < 52; i++) deck.draw();
        expect(() => deck.draw()).toThrow("No cards left in the deck");
    });

    it("should shuffle cards", () => {
        const deck = new Deck();
        const original = [...deck.cards];
        deck.shuffle();
        // Not guaranteed, but likely
        expect(deck.cards).not.toEqual(original);
    });
});
