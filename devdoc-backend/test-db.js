
const pool = require("./db");

async function testConnection() {
    try {
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public';
        `);

        console.log("Tables in database:", result.rows);

        console.log("Database connected successfully!");
        console.log("Database time:", result.rows[0].now);
    } catch (error) {
        console.error("Database connection failed:", error.message);
    } finally {
        await pool.end();
    }
}

testConnection();