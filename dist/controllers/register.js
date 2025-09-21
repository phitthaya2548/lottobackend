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
exports.router.get("/", (_req, res) => {
    res.send("registeดฟดฟดฟr");
});
exports.router.post("/", async (req, res) => {
    try {
        const user = req.body;
        const money = Number(req.body?.money ?? 0);
        if (!user?.username?.trim() || !user?.email?.trim() || !user?.password) {
            res.status(400).json({
                message: "username, email, password are required",
            });
        }
        if (user.password.length < 8) {
            res
                .status(400)
                .json({ message: "password must be at least 8 characters" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(user.password, 10);
        const sqlUser = `
      INSERT INTO users
      (username, email, password_hash, full_name, phone, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'MEMBER',
        CONVERT_TZ(NOW(), '+00:00', '+07:00'),
        CONVERT_TZ(NOW(), '+00:00', '+07:00'))
    `;
        const paramsUser = [
            user.username.trim(),
            user.email.trim(),
            hashedPassword,
            user.full_name?.trim() || null,
            user.phone?.trim() || null,
        ];
        db_1.conn.execute(sqlUser, paramsUser, (err, results) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    res.status(409).json({ message: "username or email already exists" });
                }
                console.error("DB Error:", err.sqlMessage || err.message || err);
                res.status(500).json({ message: "DB Error" });
            }
            const r = results;
            if (r.affectedRows === 1) {
                const userId = r.insertId;
                const sqlWallet = `
          INSERT INTO wallets (user_id, balance, created_at, updated_at)
          VALUES (?, ?, CONVERT_TZ(NOW(), '+00:00', '+07:00'),
                        CONVERT_TZ(NOW(), '+00:00', '+07:00'))
          ON DUPLICATE KEY UPDATE
            balance = VALUES(balance),
            updated_at = VALUES(updated_at)
        `;
                const paramsWallet = [userId, money];
                db_1.conn.execute(sqlWallet, paramsWallet, (err2) => {
                    if (err2) {
                        console.error("Wallet DB Error:", err2.sqlMessage || err2);
                        res.status(201).json({
                            success: true,
                            message: "User registered, but wallet creation failed",
                            user: {
                                id: userId,
                                username: user.username.trim(),
                                email: user.email.trim(),
                                full_name: user.full_name?.trim() || null,
                                phone: user.phone ?? null,
                                role: "MEMBER",
                            },
                            wallet: null,
                        });
                    }
                    // สำเร็จทั้ง user + wallet
                    res.status(201).json({
                        success: true,
                        message: "User registered successfully",
                        user: {
                            id: userId,
                            username: user.username.trim(),
                            email: user.email.trim(),
                            full_name: user.full_name?.trim() || null,
                            phone: user.phone ?? null,
                            role: "MEMBER",
                        },
                        wallet: {
                            balance: money,
                        },
                    });
                });
            }
            else {
                res
                    .status(500)
                    .json({ success: false, message: "Failed to register user" });
            }
        });
    }
    catch (e) {
        console.error("Unexpected Error:", e);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.default = exports.router;
