const Redis = require('ioredis');
const redis = new Redis();

async function enqueueLoop() {
  let counter = 0;
  while (true) {
    const task = {
      id: Date.now().toString(),
      message: `Task number ${counter}`,
      timestamp: new Date().toISOString(),
    };

    await redis.lpush('taskQueue', JSON.stringify(task));
    console.log('Enqueued:', task);

    counter++;
    await new Promise((r) => setTimeout(r, 1000)); // enqueue every 1 second
  }
}

enqueueLoop().catch(console.error);
