from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import redis
import json
import uuid
import os
import asyncio

app = FastAPI()

# Configuración de Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
QUEUE_NAME = "queue:tasks"

# For normal commands
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# For PubSub
pubsub_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
pubsub = pubsub_client.pubsub()

# Modelo de datos para las tareas
class Task(BaseModel):
    action: str
    playerId: str = None
    gameId: str = None

@app.post("/game/")
async def create_game(task: dict):
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "create",
    }
    await asyncio.to_thread(pubsub.subscribe, "task:completed")
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
        while True:
            message = await asyncio.to_thread(pubsub.get_message, timeout=10)
            if message and message['type'] == 'message':
                data = json.loads(message['data'])
                if data.get("id") == task_id:
                    if data.get("status") == "success":
                        return {"gameId": data.get("gameId")}
                    else:
                        raise HTTPException(status_code=500, detail=data.get("message", "Error en la tarea"))
            await asyncio.sleep(0.1)
    finally:
        await asyncio.to_thread(pubsub.unsubscribe, "task:completed")
        pubsub.close()

@app.post("/game/{game_id}/join")
def join_game(game_id: str, task: Task):
    if not task.playerId:
        raise HTTPException(status_code=400, detail="playerId es requerido")
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "join",
        "playerId": task.playerId,
        "gameId": game_id
    }
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

    return {"status": "enqueued", "task_id": task_id}

@app.post("/game/{game_id}/start")
def start_game(game_id: str, task: Task):
    if not task.playerId:
        raise HTTPException(status_code=400, detail="playerId es requerido")
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "start",
        "playerId": task.playerId,
        "gameId": game_id
    }
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

    return {"status": "enqueued", "task_id": task_id}

@app.post("/game/{game_id}/hit")
def hit(game_id: str, task: Task):
    if not task.playerId:
        raise HTTPException(status_code=400, detail="playerId es requerido")
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "hit",
        "playerId": task.playerId,
        "gameId": game_id
    }
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

    return {"status": "enqueued", "task_id": task_id}

@app.post("/game/{game_id}/stand")
def stand(game_id: str, task: Task):
    if not task.playerId:
        raise HTTPException(status_code=400, detail="playerId es requerido")
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "stand",
        "playerId": task.playerId,
        "gameId": game_id
    }
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e
    return {"status": "enqueued", "task_id": task_id}

@app.post("/game/{game_id}/leave")
def leave(game_id: str, task: Task):
    if not task.playerId:
        raise HTTPException(status_code=400, detail="playerId es requerido")
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "leave",
        "playerId": task.playerId,
        "gameId": game_id
    }
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

    return {"status": "enqueued", "task_id": task_id}


@app.post("/game/{game_id}/reset")
def reset_game(game_id: str):
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "reset",
        "gameId": game_id
    }
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

    return {"status": "enqueued", "task_id": task_id}

@app.get("/game/{game_id}/status")
def get_game_status(game_id: str):
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "status",
        "gameId": game_id
    }
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

    return {"status": "enqueued", "task_id": task_id}


@app.get("/games")
def get_all_games():
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "listGames"
    }
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e

    return {"status": "enqueued", "task_id": task_id}


