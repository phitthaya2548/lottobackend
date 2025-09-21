"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
exports.router = express_1.default.Router();
exports.router.post("/", async (req, res) => {
    try {
        const userInput = req.body;
        const username = userInput.username?.trim();
        const password = userInput.password;
        if (!username || !password) {
            res.status(400).json({ message: "username and password are required" });
            return;
        }
        const sql = `
      SELECT id, username, full_name, phone, role, password_hash
      FROM users
      WHERE username = ?
      LIMIT 1
    `;
        db_1.conn.execute(sql, [username], async (err, results) => {
            if (err) {
                console.error("DB Error:", err.sqlMessage || err.message || err);
                res.status(500).json({ message: "Internal Server Error" });
                return;
            }
            const rows = results;
            const user = rows?.[0];
            if (!user) {
                res.status(401).json({ message: "Invalid username or password" });
                return;
            }
            const isMatch = await bcryptjs_1.default.compare(password, user.password_hash);
            if (!isMatch) {
                res.status(401).json({ message: "Invalid username or password" });
                return;
            }
            res.json({
                message: "login success",
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name || null,
                    phone: user.phone,
                    role: user.role,
                },
            });
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
