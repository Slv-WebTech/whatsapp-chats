import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const queueCache = new Map();
let sharedConnection = null;

function createRedisConnection() {
    const redisUrl = String(process.env.REDIS_URL || '').trim();
    if (!redisUrl) {
        throw new Error('REDIS_URL is required for BullMQ queue publishing.');
    }

    return new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true
    });
}

function getConnection() {
    if (sharedConnection) {
        return sharedConnection;
    }

    sharedConnection = createRedisConnection();
    return sharedConnection;
}

export function getQueue(name) {
    const safeName = String(name || '').trim();
    if (!safeName) {
        throw new Error('Queue name is required.');
    }

    if (queueCache.has(safeName)) {
        return queueCache.get(safeName);
    }

    const queue = new Queue(safeName, {
        connection: getConnection(),
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1500 },
            removeOnComplete: 200,
            removeOnFail: 500
        }
    });

    queueCache.set(safeName, queue);
    return queue;
}
