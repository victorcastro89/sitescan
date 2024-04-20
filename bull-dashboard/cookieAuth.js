const { FastifyAdapter } = require('@bull-board/fastify');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const pointOfView = require('@fastify/view');
const path = require('path');
if(process.env.BOARD_PASS.length <6) throw "YOU MUST DEFINE A 6 CHARACTHERS PASSWORD LENGTH FOR BULL BOARD"
if(process.env.BOARD_USER.length <3) throw "YOU MUST DEFINE A 3 CHARACTHERS user LENGTH FOR BULL BOARD"

module.exports.cookieAuth = function cookieAuth(fastify, { queue }, next) {
  fastify.register(require('@fastify/cookie'), {
    secret: 'Dsp0hSVhnxbozucNCr3CBJvlHaNNP4BV', // for cookies signature
  });

  fastify.register(require('@fastify/jwt'), {
    secret: 'h74GZYI0qayBbBD8mRJMCDNJ7snnkS6w',
    cookie: {
      cookieName: 'token',
    },
  });

  fastify.after(() => {
    const serverAdapter = new FastifyAdapter();

    createBullBoard({
      queues:  queue.map(queue => new BullMQAdapter(queue)),
      serverAdapter,
    });
   
    serverAdapter.setBasePath('/ui');
    fastify.register(serverAdapter.registerPlugin(), { prefix: '/ui' });

    fastify.register(pointOfView, {
      engine: {
        ejs: require('ejs'),
      },
      root: path.resolve('./views'),
    });

    fastify.route({
      method: 'GET',
      url: '/login',
      handler: (req, reply) => {
        reply.view('login.ejs');
      },
    });

    fastify.route({
      method: 'POST',
      url: '/login',
      handler: async (req, reply) => {
        const { username = '', password = '' } = req.body;

        if (username === process.env.BOARD_USER && password === process.env.BOARD_PASS) {
          const token = await reply.jwtSign({
            name: 'foo',
            role: ['admin', 'spy'],
          });

          reply
            .setCookie('token', token, {
              path: '/',
              secure: false, // send cookie over HTTPS only
              httpOnly: true,
              sameSite: true, // alternative CSRF protection
            })
            .send({ success: true, url: '/ui' });
        } else {
          reply.code(401).send({ error: 'invalid_username_password' });
        }
      },
    });

    fastify.addHook('preHandler', async (request, reply) => {
      if (request.url === '/login') {
        return;
      }

      try {
        await request.jwtVerify();
      } catch (error) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    });
  });

  next();
};
