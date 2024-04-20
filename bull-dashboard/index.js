const dotenv = require('dotenv');
dotenv.config();

const { Queue: QueueMQ, Worker } = require('bullmq');
const fastify = require('fastify');
const { basicAuth } = require('./basicAuth');
const { cookieAuth } = require('./cookieAuth');

const sleep = (t) => new Promise((resolve) => setTimeout(resolve, t * 1000));

const redisOptions = {
  port: 6379,
 // host: '96.125.168.116',
 host: process.env.HOST | 'localhost', 
 //password: '',
  tls: false,
};

const createQueueMQ = (name) => new QueueMQ(name, { connection: redisOptions });

async function setupBullMQProcessor(queueName) {
  new Worker(
    queueName,
    async (job) => {
      for (let i = 0; i <= 100; i++) {
        await sleep(Math.random());
        await job.updateProgress(i);
        await job.log(`Processing job at interval ${i}`);

        if (Math.random() * 200 < 1) throw new Error(`Random error ${i}`);
      }

      return { jobId: `This is the return value of job (${job.id})` };
    },
    {
      connection: redisOptions,
    }
  );
}



const queueNames = ['dnsLookup', 'httpCheck', 'RipeStatsCall', 'WappalizerCall', 'saveToDB'];
const queues = queueNames.map((name) => new QueueMQ(name, { connection: redisOptions }));


const run = async () => {
  

  //await setupBullMQProcessor(exampleBullMq.name);

  const app = fastify();

  //app.register(basicAuth, { queue: exampleBullMq });
  app.register(cookieAuth, { queue: queues });

 

  await app.listen({ host:'0.0.0.0', port: 3000 });
  // eslint-disable-next-line no-console
  console.log('Running on 3000...');
  console.log('For the UI with cookie auth, open http://localhost:3000/');
  console.log('Make sure Redis is running on port 6379 by default');
  console.log('To populate the queue, run:');
  console.log('  curl http://localhost:3000/add?title=Example');
  console.log('To populate the queue with custom options (opts), run:');
  console.log('  curl http://localhost:3000/add?title=Test&opts[delay]=9');
};

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
