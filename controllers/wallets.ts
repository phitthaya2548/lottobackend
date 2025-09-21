import express from "express";
import { conn } from "../db";  // นำเข้า connection สำหรับการเชื่อมต่อกับฐานข้อมูล

export const router = express.Router();  // สร้าง Router ของ Express

// ฟังก์ชันสำหรับดึงข้อมูลการทำธุรกรรมของผู้ใช้
router.get("/transactions", async (req, res) => {
  try {
    // รับค่า userId จาก query parameter และตั้งค่าจำนวนบันทึก (limit) ที่จะดึง
    const userId = Number(req.query.userId);
    const limit = Math.min(Number(req.query.limit ?? 50), 200);  // จำกัดจำนวนผลลัพธ์สูงสุดที่ 200

    // ตรวจสอบว่า userId เป็นจำนวนเต็มและมากกว่า 0 หรือไม่
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ success: false, message: "userId:int required" });
      return;
    }

    // ดึงข้อมูลจากตาราง wallets เพื่อหา wallet_id ของผู้ใช้
    const [wrs] = await conn
      .promise()
      .query(`SELECT id FROM wallets WHERE user_id=? LIMIT 1`, [userId]);
    const walletId = (wrs as any[])[0]?.id;  // ได้ wallet_id ของผู้ใช้
    if (!walletId) {
      // ถ้าไม่มี wallet_id สำหรับ userId นี้ ให้คืนข้อมูลเป็น 0
      res.json({
        success: true,
        summary: { in: 0, out: 0, net: 0 },
        items: [],
      });
      return;
    }

    // คำนวณยอดรวมการฝาก (in), ถอน (out) และยอดสุทธิ (net) จากตาราง wallet_transactions
    const [srs] = await conn.promise().query(
      `SELECT
           COALESCE(SUM(CASE WHEN amount > 0 THEN amount END),0) AS total_in,
           COALESCE(SUM(CASE WHEN amount < 0 THEN -amount END),0) AS total_out,
           COALESCE(SUM(amount),0) AS net
         FROM wallet_transactions
         WHERE wallet_id=?`,
      [walletId]
    );

    // ดึงข้อมูลรายการการทำธุรกรรม (transactions) ล่าสุด ตามจำนวน limit ที่กำหนด
    const [rows] = await conn.promise().query(
      `SELECT id, tx_type, amount, ref_type, ref_id, note, created_at
         FROM wallet_transactions
         WHERE wallet_id=?
         ORDER BY created_at DESC
         LIMIT ?`,
      [walletId, limit]
    );

    // ส่งผลลัพธ์การทำธุรกรรมกลับไปให้ client
    res.json({ success: true, items: rows });
  } catch (err: any) {
    // ถ้ามีข้อผิดพลาดเกิดขึ้น จะแสดงข้อผิดพลาดใน console
    console.error(
      "transactions error:",
      err?.sqlMessage || err?.message || err
    );
    // ส่ง response กลับไปว่าเกิดข้อผิดพลาดในระบบ
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ฟังก์ชันสำหรับดึงข้อมูลยอดเงินคงเหลือใน wallet ของผู้ใช้
router.get("/balance", async (req, res) => {
  // รับค่า userId จาก query parameter
  const userId = Number(req.query.userId);
  // ตรวจสอบว่า userId เป็นจำนวนเต็มหรือไม่
  if (!Number.isInteger(userId)) {
    res.status(400).json({ success: false, message: "userId:int required" });
    return;
  }

  // ดึงข้อมูลยอดเงินจากตาราง wallets โดยใช้ userId
  const [wr] = await conn
    .promise()
    .query(`SELECT id, balance FROM wallets WHERE user_id=? LIMIT 1`, [userId]);
  const w = (wr as any[])[0];  // เอาผลลัพธ์แรกจากการดึงข้อมูล

  // ส่งข้อมูลยอดเงินคงเหลือกลับไปให้ client
  res.json({
    success: true,
    wallet: { id: w?.id ?? null, balance: Number(w?.balance ?? 0) },
  });
});
