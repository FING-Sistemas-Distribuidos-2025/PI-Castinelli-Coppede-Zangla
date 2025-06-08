from fastapi import FastAPI, HTTPException, Request
import redis
import json
import uuid
import os
import asyncio

app = FastAPI()

# Configuración de Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
QUEUE_NAME = "queue:tasks"
WAITING_GAMES_KEY = "games:waiting"

# Conexión principal a Redis (comandos normales)
print(f"Conectando a Redis en {REDIS_HOST}:{REDIS_PORT}")
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)

# Espera respuesta del pubsub
@app.post("/games")
async def create_game():
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "create",
    }
    print(f"[POST /games] Encolando tarea de creación de juego: {task_id}")

    pubsub_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)
    pubsub = pubsub_client.pubsub()
    channel_name = f"task:completed:{task_id}"
    print(f"[POST /games] Suscribiéndose a canal: {channel_name}")

    try:
        await asyncio.to_thread(pubsub.subscribe, channel_name)
        r.lpush(QUEUE_NAME, json.dumps(task_data))
        print(f"[POST /games] Esperando respuesta del worker para tarea: {task_id}")

        timeout = 10  # segundos
        end_time = asyncio.get_event_loop().time() + timeout

        while asyncio.get_event_loop().time() < end_time:
            message = await asyncio.to_thread(pubsub.get_message, timeout=1)
            if message and message['type'] == 'message':
                data = json.loads(message['data'])
                print(f"[POST /games] Mensaje recibido: {data}")
                if data.get("status") == "success":
                    print(f"[POST /games] Juego creado exitosamente: {data.get('gameId')}")
                    return {"gameId": data.get("gameId")}
                else:
                    print(f"[POST /games] Error en la tarea: {data.get('message')}")
                    raise HTTPException(status_code=500, detail=data.get("message", "Error en la tarea"))
            await asyncio.sleep(0.1)

        print(f"[POST /games] Timeout esperando respuesta del worker para tarea: {task_id}")
        raise HTTPException(status_code=504, detail="Timeout esperando respuesta del worker")
    finally:
        await asyncio.to_thread(pubsub.unsubscribe, channel_name)
        pubsub.close()
        print(f"[POST /games] Desuscrito de canal: {channel_name}")

def enqueue_task(action: str, game_id: str, player_id = None):
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": action,
        "gameId": game_id,
    }
    if player_id:
        task_data["playerId"] = player_id

    print(f"[enqueue_task] Encolando tarea: {task_data}")
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        print(f"[enqueue_task] Redis no disponible: {e}")
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

    return {"status": "enqueued", "task_id": task_id}

@app.get("/games/{game_id}")
def get_game_status(game_id: str):
    print(f"[GET /games/{{game_id}}] Consultando estado del juego: {game_id}")
    try:
        game_data = r.get(f"game:{game_id}")
        if not game_data:
            print(f"[GET /games/{{game_id}}] Juego no encontrado: {game_id}")
            raise HTTPException(status_code=404, detail="Juego no encontrado")
        return json.loads(game_data)
    except redis.RedisError as e:
        print(f"[GET /games/{{game_id}}] Redis no disponible: {e}")
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

def get_player_id_from_token(request: Request):
    # Placeholder: replace with actual token extraction logic
    # Example: return request.state.user_id or decode JWT from headers
    return request.headers.get("X-Player-Id")

@app.post("/games/{game_id}/join")
def join_game(game_id: str, request: Request):
    player_id = get_player_id_from_token(request)
    if not player_id:
        raise HTTPException(status_code=401, detail="No autorizado: falta player_id")
    return enqueue_task("join", game_id, player_id)

@app.post("/games/{game_id}/start")
def start_game(game_id: str, request: Request):
    player_id = get_player_id_from_token(request)
    if not player_id:
        raise HTTPException(status_code=401, detail="No autorizado: falta player_id")
    return enqueue_task("ready", game_id, player_id)

@app.post("/games/{game_id}/hit")
def hit(game_id: str, request: Request):
    player_id = get_player_id_from_token(request)
    if not player_id:
        raise HTTPException(status_code=401, detail="No autorizado: falta player_id")
    return enqueue_task("hit", game_id, player_id)

@app.post("/games/{game_id}/stand")
def stand(game_id: str, request: Request):
    player_id = get_player_id_from_token(request)
    if not player_id:
        raise HTTPException(status_code=401, detail="No autorizado: falta player_id")
    return enqueue_task("stand", game_id, player_id)

@app.post("/games/{game_id}/leave")
def leave(game_id: str, request: Request):
    player_id = get_player_id_from_token(request)
    if not player_id:
        raise HTTPException(status_code=401, detail="No autorizado: falta player_id")
    return enqueue_task("leave", game_id, player_id)

@app.get("/games")
def get_all_games():
    print(f"[GET /games] Listando juegos en espera")
    try:
        game_ids = r.lrange(WAITING_GAMES_KEY, 0, -1)
        games = []
        for game_id in game_ids:
            game_data = r.get(f"game:{game_id}")
            if game_data:
                games.append(json.loads(game_data))
        print(f"[GET /games] Juegos encontrados: {len(games)}")
        return games
    except redis.RedisError as e:
        print(f"[GET /games] Redis no disponible: {e}")
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

@app.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    try:
        task_info = r.get(f"task:{task_id}")
        if not task_info:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")
        return json.loads(task_info)
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e
