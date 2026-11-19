const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");

const router = express.Router();
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Basic validation
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters."
            });
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Save the user in PostgreSQL
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, created_at`,
            [name.trim(), email.trim().toLowerCase(), passwordHash]
        );

        req.session.userId = result.rows[0].id;

        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({
                    message: "Account created, but login failed."
            });
        }

        res.status(201).json({
            message: "Account created successfully!",
            user: result.rows[0]
        });
    });  

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        console.error("Registration error:", error);

        res.status(500).json({
            message: "Something went wrong during registration."
        });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = result.rows[0];

        const isMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({
                    message: "Login failed."
                });
            }

            req.session.userId = user.id;

            req.session.save((err) => {
                if (err) {
                    return res.status(500).json({
                        message: "Could not create login session."
                    });
                }

                res.json({
                    message: "Login successful!",
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email
                    }
                });
            });
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Something went wrong during login."
        });
    }
});
router.get("/me", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                message: "Not authenticated."
            });
        }

        const result = await pool.query(
            "SELECT id, name, email FROM users WHERE id = $1",
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "User not found."
            });
        }

        res.json({
            authenticated: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Auth check error:", error);

        res.status(500).json({
            message: "Authentication check failed."
        });
    }
});
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                message: "Logout failed."
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            message: "Logged out successfully."
        });
    });
});
module.exports = router;