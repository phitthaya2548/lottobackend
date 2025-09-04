import bcrypt from "bcryptjs";
import express from "express";
import mysql from "mysql2";
import { conn } from "../db";
import { generateToken } from "../middleware/jwt";
import { User } from "../models/user";

export const router = express.Router();

router.post("/", async (req, res) => {
  const userInput: User = req.body;
  const sql = "SELECT * FROM users WHERE email = ?";
  const formattedSql = mysql.format(sql, [userInput.email]);

  conn.query(formattedSql, async (err, results: any[]) => {

    if (err) {
      // log แบบเต็ม ๆ
      console.error('❌ DB Error:', err);
    
      // log แค่ข้อความ error
      console.error('❌ Error message:', err.message);
    
      // ถ้ามี stack trace
      if (err.stack) {
        console.error('❌ Stack trace:', err.stack);
      }
    
      return res.status(500).json({ message: "Internal Server Error" });
    }
    

    const user = results[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(userInput.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      id: user.id,
      email: user.email,
      name: user.username,
      role: user.role
    });
  });
});
