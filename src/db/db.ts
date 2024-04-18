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

// Function to delete data from the specified tables
async function clearDatabase() {
  try {
    if (process.env.NODE_ENV === 'production' ) {
      console.error('This script cannot be run in the production environment.');
      return; // Exit function if in production
    }

    // Starting a transaction to ensure data integrity
    await db.transaction(async trx => {
      await trx('public.domain_status').del(); // Deleting all records from domain_status
      await trx('public.domain_technologies').del(); // Deleting all records from domain_technologies
    });
    console.log('Data cleared from the tables successfully.');
  } catch (error) {
    console.error('Failed to clear data from the tables:', error);
  } 
}

// Execute the clearDatabase function if not in production



export {db,clearDatabase}
