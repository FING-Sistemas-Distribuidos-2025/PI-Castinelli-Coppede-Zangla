from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import redis
import json
import uuid
import os

app = FastAPI()

# Configuración de Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
QUEUE_NAME = "queue:tasks"

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# Modelo de datos para las tareas
class Task(BaseModel):
    action: str
    playerId: str = None
    gameId: str = None

@app.post("/game/create")
def create_game(task: Task):
    if not task.playerId:
        raise HTTPException(status_code=400, detail="playerId es requerido")
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "create",
        "playerId": task.playerId
    }
    try:
        r.lpush(QUEUE_NAME, json.dumps(task_data))
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis no disponible") from e
    
    
    return {"status": "enqueued", "task_id": task_id}

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

@app.post("/game/{game_id}/dealerPlay")
def dealer_play(game_id: str):
    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "action": "dealerPlay",
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
