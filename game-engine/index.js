const Redis = require("ioredis");
const redis = new Redis();

async function processQueue() {
    while (true) {
        try {
            // brpop returns [queueName, taskString]
            const result = await redis.brpop("taskQueue", 0);
            const taskString = result[1];
            const taskData = JSON.parse(taskString);

            if (!taskData || !taskData.id) {
                console.error("Invalid task data:", taskData);
                continue;
            }

            console.log("Processing task:", taskData);

            // Simulate some work (e.g., business logic)
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const taskResult = {
                status: "success",
                taskId: taskData.id,
            };

            await redis.set(
                `task:${taskData.id}`,
                JSON.stringify({ ...taskData, ...taskResult })
            );

            console.log(`Task ${taskData.id} completed successfully.`);
        } catch (err) {
            console.error("Worker error:", err);

            await redis.set(
                `task:${taskData.id}`,
                JSON.stringify({
                    ...taskData,
                    status: "error",
                    error: err.message,
                })
            );
        }
    }
}

processQueue();
