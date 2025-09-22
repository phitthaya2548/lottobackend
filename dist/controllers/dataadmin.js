"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
exports.router = express_1.default.Router();
exports.router.get("/selled", async (req, res) => {
    try {
        const sql = `
        SELECT 
          COALESCE(COUNT(*), 0) AS count
        FROM tickets
      `;
        const [rows] = await db_1.conn.promise().query(sql);
        const count = rows[0]?.count ?? 0;
        res.json({ success: true, soldTickets: count });
    }
    catch (err) {
        console.error("DB Error:", err.sqlMessage || err.message || err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});
exports.router.get("/users", async (req, res) => {
    try {
        const sql = `
        SELECT 
          COALESCE(COUNT(*), 0) AS count
        FROM users
      `;
        const [rows] = await db_1.conn.promise().query(sql);
        const count = rows[0]?.count ?? 0;
        res.json({ success: true, users: count });
    }
    catch (err) {
        console.error("DB Error:", err.sqlMessage || err.message || err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});
exports.router.get("/income", async (req, res) => {
    try {
        const sql = `
        SELECT 
          COALESCE(SUM(draw_id) * 100, 0) AS income
        FROM tickets `;
        const [rows] = await db_1.conn.promise().query(sql);
        const income = rows[0]?.income ?? 0;
        res.json({ success: true, income });
    }
    catch (err) {
        console.error("DB Error:", err.sqlMessage || err.message || err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});
exports.router.get("/resetall", async (req, res) => {
    const db = db_1.conn.promise();
    try {
        await db.query("DELETE FROM tickets");
        await db.query("DELETE FROM draws where status='CLOSED'");
        await db.query("DELETE FROM users WHERE role='MEMBER'");
        await db.query("DELETE FROM wallet");
        res.json({ success: true, message: "Deleted tickets and draws" });
    }
    catch (err) {
        console.error("DB Error:", err.sqlMessage || err.message || err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});
