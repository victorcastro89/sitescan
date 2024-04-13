// Update with your config settings.

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {

    development: {
      client: 'postgresql',
      connection: {
        host: 'localhost',  // This matches the service name in docker-compose.yml
        database: 'postgres',
        user:     'docker',
        password: 'docker'
      },    pool: {
        min: 2,
        max: 10
      },
  },

 
  production: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user:     'username',
      password: 'password'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }

};
