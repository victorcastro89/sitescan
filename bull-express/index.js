/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue: QueueMQ, Worker } = require('bullmq');
const express = require('express');

const sleep = (t) => new Promise((resolve) => setTimeout(resolve, t * 1000));

const redisOptions = {
  port: 6379,
  host: 'localhost',
 // host: '96.125.168.116',
  
 password: '',
  tls: false,
};

const queueNames = ['dnsLookup', 'httpCheck', 'RipeStatsCall', 'WappalizerCall', 'saveToDB'];
const queues = queueNames.map((name) => new QueueMQ(name, { connection: redisOptions }));

async function setupBullMQProcessor(queueName) {
  return new Worker(queueName, async (job) => {
    for (let i = 0; i <= 100; i++) {
      await sleep(Math.random());
      await job.updateProgress(i);
      await job.log(`Processing job at interval ${i}`);

      if (Math.random() * 200 < 1) throw new Error(`Random error at interval ${i}`);
    }

    return { jobId: `Job completed: ${job.id}` };
  });
}

const run = async () => {
  // for (const queue of queues) {
  //   await setupBullMQProcessor(queue.name);
  // }

  const app = express();
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/ui');

  createBullBoard({
    queues: queues.map(queue => new BullMQAdapter(queue)),
    serverAdapter,
  });

  app.use('/ui', serverAdapter.getRouter());

  app.use('/add', (req, res) => {
    const { title, queueName, delay } = req.query;
    const queue = queues.find(q => q.name === queueName);

    if (!queue) {
      return res.status(404).json({ error: "Queue not found" });
    }

    const options = delay ? { delay: +delay * 1000 } : {};
    queue.add('job', { title }, options);

    res.json({ ok: true, message: `Job added to ${queueName}` });
  });

  app.listen(3000, () => {
    console.log('Running on port 3000...');
    console.log('UI available at http://localhost:3000/ui');
    console.log('Make sure Redis is running on port 6379 by default');
    console.log('Add jobs via: curl "http://localhost:3000/add?title=Example&queueName=dnsLookup"');
  });
};

run().catch(console.error);
