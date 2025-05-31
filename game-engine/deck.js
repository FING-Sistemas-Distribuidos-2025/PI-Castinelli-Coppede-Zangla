const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
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
    "Jack",
    "Queen",
    "King",
    "Ace",
];

export default class Deck {
    constructor() {
        this.cards = [];
        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push({ suit, rank });
            }
        }
    }

    draw() {
        if (this.cards.length === 0) {
            throw new Error("No cards left in the deck");
        }
        return this.cards.pop();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
}
