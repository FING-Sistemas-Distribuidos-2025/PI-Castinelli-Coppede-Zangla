const gameSession={
  "game:<sessionId>": {
    "playerHand": ["9♦", "K♠"],
    "dealerHand": ["8♣", "?"], 
    "deck": ["remaining cards"],
    "status": "player_turn"
  }
}

// This is a mockup of a game session object. In a real application, you would likely use a database to store this information.
// The session ID would be a unique identifier for each game session, and the player and dealer hands would be arrays of card strings.