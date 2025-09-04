import bcrypt from "bcryptjs";
import express from "express";
import mysql from "mysql2";
import { conn } from "../db";
import { User } from "../models/user";

export const router = express.Router();
router.get("/", (req, res) => {
  res.send("register");
});
router.post("/", async (req, res) => {
  let user: User = req.body;
  let hashedPassword = await bcrypt.hash(user.password, 10);
  const sql = `
  INSERT INTO users (username, email, password_hash, full_name, role, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())
`;

  const formattedSql = mysql.format(sql, [
    user.username,
    user.email,
    hashedPassword,
    user.full_name,
    user.role ?? "GUEST",
  ]);

  conn.query(formattedSql, (err, results) => {
    if (err) {
      console.error("DB error:", err); // ดูใน console
      return res.status(500).json({
        message: "DB Error",
        code: err.code,
        errno: err.errno,
        sqlState: err.sqlState,
        
      });
    }
    res.status(201).json({ message: "User registered successfully" });
  });
});
  
