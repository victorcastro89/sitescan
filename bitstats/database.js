require('dotenv').config();
const mysql = require('mysql2/promise');
const {  DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, DB_DATABASE } = process.env;

// Create a connection pool
const pool = mysql.createPool({
    connectionLimit: 10, // Max number of connections
    host:DB_HOST,
    port:DB_PORT,
    user:DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE
});

async function query(sql, params) {
    const [results, ] = await pool.execute(sql, params);
    return results;
}

async function closePool() {
    await pool.end();
}

process.on('SIGINT', async () => {
    console.log('Gracefully shutting down...');
    await closePool();
    process.exit(0);
});

module.exports = {
    query,
};
