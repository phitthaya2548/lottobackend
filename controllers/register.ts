import bcrypt from "bcryptjs";
import express from "express";
import mysql from "mysql2";
import { conn } from "../db";
import { User } from "../models/user";

export const router = express.Router();


router.get("/", (_req, res) => {
  res.send("registeดฟดฟดฟr");
});

router.post("/", async (req, res) => {
  try {
    const user: User = req.body;

    if (!user?.username?.trim() || !user?.email?.trim() || !user?.password) {
      res.status(400).json({
        message: "username, email, password are required",
      });
      return;
    }
    if (user.password.length < 8) {
      res
        .status(400)
        .json({ message: "password must be at least 8 characters" });
      return;
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);

    const sql = `
    INSERT INTO users
    (username, email, password_hash, full_name, phone, role,  created_at, updated_at)
    VALUES (?, ?, ?,  ?, 'MEMBER',  CONVERT_TZ(NOW(), '+00:00', '+07:00'), CONVERT_TZ(NOW(), '+00:00', '+07:00'))
  `;
  
  const params = [
    user.username.trim(),
    user.email.trim(),
    hashedPassword,
    user.full_name?.trim() || null,
    user.phone?.trim() || null,
  ];
  

    conn.execute(sql, params, (err, results) => {
      if (err) {
        if ((err as any).code === "ER_DUP_ENTRY") {
          res.status(409).json({ message: "username or email already exists" });
          return;
        }
        console.error(
          "DB Error:",
          (err as any).sqlMessage || err.message || err
        );
        res.status(500).json({ message: "DB Error" });
        return;
      }

      const r = results as mysql.ResultSetHeader;
      if (r.affectedRows === 1) {
        res.status(201).json({
          success: true,
          message: "User registered successfully",
          user: {
            id: r.insertId,
            username: user.username.trim(),
            email: user.email.trim(),
            full_name: user.full_name?.trim() || null, // ✅ ตอบกลับ null ถ้าไม่ได้ส่ง
            phone: user.phone ?? null,
            role: "MEMBER",
            status: "ACTIVE",
          },
        });
        return;
      }

      res
        .status(500)
        .json({ success: false, message: "Failed to register user" });
    });
  } catch (e) {
    console.error("Unexpected Error:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
