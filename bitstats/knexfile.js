// knexfile.js
require('dotenv').config();

module.exports = {
  development: {
    client: 'mysql2', // Change this to your DB client
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      port: process.env.DB_PORT,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE
    },
    migrations: {
      directory: __dirname + '/migrations',
    }
  },

  // Add other environments (staging, production, etc.) as needed
};
