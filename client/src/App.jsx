import { useEffect, useRef, useState } from "react";

function App() {
  const [playerId, setPlayerId] = useState("");
  const [gameId, setGameId] = useState("");
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);

  // Connect to WebSocket and handle messages
  useEffect(() => {
    const websocket = new WebSocket("ws://10.66.100.172:8080");
    wsRef.current = websocket;

    websocket.onopen = () => {
      setIsConnected(true);
      setError("");
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error.message || JSON.stringify(data.error));
        } else if (data.success) {
          setMessages((prev) => [...prev, { type: "success", data }]);
        } else {
          setGameState(data.data);
          setMessages((prev) => [...prev, { type: "game", data }]);
        }
      } catch (err) {
        setError("Failed to parse message");
      }
    };

    websocket.onclose = () => {
      setIsConnected(false);
      setError("WebSocket disconnected");
    };

    websocket.onerror = () => {
      setError("WebSocket error");
    };

    return () => {
      websocket.close();
    };
  }, []);

  // Send WebSocket message
  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      setError("Not connected to server");
    }
  };

  // Handle registration
  const handleRegister = () => {
    if (!playerId) {
      setError("Player ID is required");
      return;
    }
    sendMessage({ action: "register", playerId });
  };

  // Handle game actions
  const handleAction = (action) => {
    if (!playerId) {
      setError("Register first");
      return;
    }
    if (action === "join" && !gameId) {
      setError("Game ID required for join");
      return;
    }
    sendMessage({ action, playerId, gameId: gameId || undefined });
  };

  // Render game state in a readable format
  const renderGameState = (state) => {
    if (!state) return null;
    return (
      <div>
        <h3>Game State (Game ID: {state.id})</h3>
        <p>Turn: {state.turn}</p>
        <h4>Players:</h4>
        <ul>
          {state.players.map((player, index) => (
            <li key={index}>
              Player {index + 1}: {JSON.stringify(player.hand)} (Score: {player.score || "N/A"})
            </li>
          ))}
        </ul>
        <h4>Dealer:</h4>
        <p>Hand: {state.dealer ? JSON.stringify(state.dealer.hand) : "N/A"}</p>
        <p>Score: {state.dealer?.score || "N/A"}</p>
      </div>
    );
  };

  // Render message history
  const renderMessages = () => {
    return (
      <div>
        <h3>Messages</h3>
        {messages.map((msg, index) => (
          <div key={index}>
            {msg.type === "success" ? (
              <p>Success: {JSON.stringify(msg.data)}</p>
            ) : (
              <div>
                <p>Game Update:</p>
                {renderGameState(msg.data.data)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <h1>Blackjack Game</h1>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      <p>Connection Status: {isConnected ? "Connected" : "Disconnected"}</p>

      <div>
        <h2>Register</h2>
        <input
          type="text"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          placeholder="Enter Player ID"
        />
        <button onClick={handleRegister}>Register</button>
      </div>

      <div>
        <h2>Game Actions</h2>
        <input
          type="text"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          placeholder="Enter Game ID (for join)"
        />
        <button onClick={() => handleAction("host")}>Host Game</button>
        <button onClick={() => handleAction("join")}>Join Game</button>
        <button onClick={() => handleAction("start")}>Start Game</button>
        <button onClick={() => handleAction("hit")}>Hit</button>
        <button onClick={() => handleAction("stand")}>Stand</button>
        <button onClick={() => handleAction("reset")}>Reset</button>
        <button onClick={() => handleAction("exit")}>Exit</button>
      </div>

      {gameState && (
        <div>
          <h2>Current Game State</h2>
          {renderGameState(gameState)}
        </div>
      )}

      {messages.length > 0 && renderMessages()}
    </div>
  );
}

export default App;
