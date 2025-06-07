export default class Player {
    constructor(playerId) {
        this.id = playerId;
        this.hand = [];
        this.stand = false;
    }

    get busted() {
        return this.score > 21;
    }

    get score() {
        let score = 0;
        let aces = 0;
        for (const card of this.hand) {
            if (card.rank === "Ace") {
                score += 11;
                aces += 1;
            } else if (["Jack", "Queen", "King"].includes(card.rank)) {
                score += 10;
            } else {
                score += parseInt(card.rank, 10);
            }
        }
        while (score > 21 && aces > 0) {
            score -= 10;
            aces -= 1;
        }
        return score;
    }

    addCard(card) {
        this.hand.push(card);
    }

    reset() {
        this.hand = [];
        this.stand = false;
    }
}
