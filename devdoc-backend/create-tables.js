const pool = require("./db");

async function createTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id VARCHAR(100) PRIMARY KEY,
                owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(80) NOT NULL,
                folder VARCHAR(255) NOT NULL,
                indexing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                indexed_chunk_count INTEGER NOT NULL DEFAULT 0,
                indexed_file_count INTEGER NOT NULL DEFAULT 0,
                indexed_at TIMESTAMPTZ,
                indexing_error TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

console.log("Projects table created successfully!");

        console.log("Users table created successfully!");
    } catch (error) {
        console.error("Table creation failed:", error);
    } finally {
        await pool.end();
    }
}

createTables();