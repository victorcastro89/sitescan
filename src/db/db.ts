import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

// Setup the database connection using Knex
const db = knex({
  client: 'pg',
  connection: {
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    port: 5432
  }
});

export {db}
