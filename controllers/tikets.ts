import type { RequestHandler } from "express";
import express from "express";
import { conn } from "../db";  // นำเข้า connection สำหรับการเชื่อมต่อกับฐานข้อมูล

export const router = express.Router();  // สร้าง Router ของ Express

// ฟังก์ชันตรวจสอบสถานะของตั๋ว
router.get("/check", async (req, res) => {
  const drawId = Number(req.query.drawId);  // รับค่า drawId จาก query parameter
  const number = String(req.query.number ?? "").trim();  // รับค่า ticket number และตัดช่องว่าง

  // ตรวจสอบว่า drawId เป็นจำนวนเต็มและ ticket number มี 6 หลัก
  if (!Number.isInteger(drawId) || !/^\d{6}$/.test(number)) {
    res.status(400).json({
      success: false,
      message: "drawId:int & number:6 digits required",  // หากไม่ตรงตามเงื่อนไขให้ส่งกลับข้อผิดพลาด
    });
  }

  // ค้นหาสถานะของตั๋วจากฐานข้อมูล
  const [rows] = await conn
    .promise()
    .query(
      `SELECT status FROM tickets WHERE draw_id=? AND ticket_number=? LIMIT 1`,
      [drawId, number]
    );

  const found = (rows as any[])[0];  // เอาผลลัพธ์แรก

  // ตอบกลับสถานะว่าเบอร์ตั๋วสามารถซื้อได้หรือไม่ พร้อมสถานะปัจจุบันของตั๋ว
  res.json({
    success: true,
    drawId,
    ticketNumber: number,
    canBuy: !found,  // ถ้าไม่พบตั๋ว หมายความว่ายังสามารถซื้อได้
    currentStatus: found?.status ?? null,  // ส่งสถานะของตั๋วถ้ามี
  });
});

// ฟังก์ชันจัดการคำขอข้อมูลตั๋วของผู้ซื้อ
const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// ฟังก์ชันดึงข้อมูลตั๋วที่ซื้อโดยผู้ซื้อ
const getTicketsByBuyer: RequestHandler = async (req, res) => {
  const drawNumber = Number(req.query.drawNumber ?? req.query.draw_number);  // รับ drawNumber จาก query
  const buyerId = Number(req.query.buyerUserId ?? req.query.buyer_user_id);  // รับ buyerUserId จาก query

  // ตรวจสอบว่า drawNumber และ buyerId เป็นจำนวนเต็มหรือไม่
  if (!Number.isInteger(drawNumber) || !Number.isInteger(buyerId)) {
    res.status(400).json({
      success: false,
      message: "drawNumber:int & buyerUserId:int required",  // ถ้าไม่เป็นจำนวนเต็มให้คืนข้อผิดพลาด
    });
    return;
  }

  // ค้นหาข้อมูลตั๋วที่ผู้ซื้อซื้อจากฐานข้อมูล
  const [rows] = await conn.promise().query(
    `SELECT t.ticket_number, t.status
       FROM tickets t
       INNER JOIN draws d ON t.draw_id = d.id
       WHERE d.draw_number = ? AND t.buyer_user_id = ?`,
    [drawNumber, buyerId]
  );

  const tickets = rows as Array<{ ticket_number: string; status: string }>;

  // ส่งข้อมูลการซื้อกลับไปยัง client
  res.json({
    success: true,
    drawNumber,
    buyerUserId: buyerId,
    count: tickets.length,  // จำนวนตั๋วที่ผู้ซื้อมี
    tickets,  // รายการตั๋วทั้งหมดที่ผู้ซื้อซื้อ
  });
};

// ใช้ asyncHandler เพื่อจัดการการทำงานแบบ async
router.get("/by-buyer-and-draw", asyncHandler(getTicketsByBuyer));

// ฟังก์ชันสำหรับการซื้อหมายเลข
router.post("/buy-number", async (req, res) => {
  const drawId = Number(req.body?.drawId);  // รับค่า drawId จาก request body
  const userId = Number(req.body?.userId);  // รับค่า userId จาก request body
  const number = String(req.body?.number ?? "").trim();  // รับหมายเลขตั๋วที่ต้องการซื้อ
  const price = 100;  // ราคา (กำหนดให้ 100)

  // ตรวจสอบค่าของ drawId, userId, number และ price ว่าถูกต้องหรือไม่
  if (
    !Number.isInteger(drawId) ||
    !Number.isInteger(userId) ||
    !/^\d{6}$/.test(number) ||
    !(price > 0)
  ) {
    res.status(400).json({
      success: false,
      message: "drawId:int, userId:int, number:6 digits, price>0 required",  // ถ้าไม่ถูกต้องส่งข้อผิดพลาดกลับ
    });
  } else {
    const tx = await conn.promise().getConnection();  // เริ่มต้นการเชื่อมต่อฐานข้อมูล
    try {
      await tx.beginTransaction();  // เริ่มธุรกรรม

      // 1) ล็อกข้อมูลงวดปัจจุบัน
      const [drows] = await tx.query(
        `SELECT id, status FROM draws WHERE id=? OR draw_number=? LIMIT 1 FOR UPDATE`,
        [drawId, drawId]
      );
      const draw = (drows as any[])[0];

      if (!draw) {
        await tx.rollback();  // หากไม่พบ draw ให้ทำการ rollback
        tx.release();
        res.status(404).json({ success: false, message: "draw not found" });
      } else if (draw.status !== "OPEN") {
        await tx.rollback();  // หากสถานะไม่ใช่ "OPEN" ทำการ rollback
        tx.release();
        res.status(409).json({ success: false, message: "draw is not OPEN" });
      } else {
        const realDrawId = Number(draw.id);

        // 2) ล็อกหรือสร้าง wallet ของผู้ใช้ (Lazy-create wallet)
        const [wrows] = await tx.query(
          `SELECT id, balance FROM wallets WHERE user_id=? FOR UPDATE`,
          [userId]
        );
        let wallet = (wrows as any[])[0];

        if (!wallet) {
          // ถ้าไม่พบ wallet ให้สร้างใหม่
          const [insw] = await tx.execute(
            `INSERT INTO wallets (user_id, balance, created_at) VALUES (?, 0, NOW())`,
            [userId]
          );
          const wid = (insw as any).insertId;
          wallet = { id: wid, balance: 0 };
        }

        // 3) จองตั๋ว (ถ้ามีหมายเลขนี้แล้วให้ไม่สามารถซื้อได้)
        let insertedId: number | undefined;
        try {
          const [ins] = await tx.execute(
            `INSERT INTO tickets (draw_id, ticket_number, price, status, buyer_user_id, sold_at)
               VALUES (?, ?, ?, 'SOLD', ?, NOW())`,
            [realDrawId, number, price, userId]
          );
          insertedId = (ins as any).insertId;
        } catch (e: any) {
          // หากมีข้อผิดพลาด (เช่น ตั๋วซ้ำ) ให้ rollback และส่งข้อความว่า "หมายเลขนี้ถูกขายไปแล้ว"
          if (e?.code === "ER_DUP_ENTRY" || e?.errno === 1062) {
            await tx.rollback();
            tx.release();
            res
              .status(409)
              .json({
                success: false,
                message: "This number has been sold already",
              });
          } else {
            throw e;  // ถ้าเกิดข้อผิดพลาดอื่นๆ ให้โยนข้อผิดพลาดออกไป
          }
          return;
        }

        // 4) หักเงินจาก wallet ของผู้ซื้อ
        const [upd]: any = await tx.execute(
          `UPDATE wallets SET balance = balance - ? WHERE id=? AND balance >= ?`,
          [price, wallet.id, price]
        );

        if (upd.affectedRows !== 1) {
          // หากยอดเงินไม่พอให้ทำการ rollback และลบตั๋วที่จอง
          await tx.execute(`DELETE FROM tickets WHERE id=?`, [insertedId]);
          await tx.rollback();
          tx.release();
          res
            .status(400)
            .json({ success: false, message: "Insufficient balance" });
        } else {
          // 5) บันทึกประวัติการทำธุรกรรมใน wallet_transactions
          await tx.execute(
            `INSERT INTO wallet_transactions (wallet_id, tx_type, amount, ref_type, ref_id, note)
                 VALUES (?, 'PURCHASE', ?, 'TICKET', ?, ?)`,

            [
              wallet.id,
              -price,
              insertedId!,
              `Buy number ${number} for draw ${realDrawId}`,
            ]
          );

          await tx.commit();  // ทำการ commit ธุรกรรม
          tx.release();

          // ส่งข้อมูลตั๋วที่ซื้อกลับไป
          res.json({
            success: true,
            message: "Ticket purchased",
            ticket: {
              id: insertedId,
              drawId: realDrawId,
              ticketNumber: number,
              price,
              status: "SOLD",
              buyerUserId: userId,
            },
          });
        }
      }
    } catch (err: any) {
      // หากเกิดข้อผิดพลาดในระหว่างกระบวนการ
      try {
        await tx.rollback();
      } catch {}
      try {
        tx.release();
      } catch {}
      console.error(
        "buy-number error:",
        err?.sqlMessage || err?.message || err
      );
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
});
