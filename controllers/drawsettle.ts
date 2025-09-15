// // routes/drawSettle.ts
// import express from "express";
// import crypto from "crypto";
// import mysql from "mysql2";
// import { conn } from "../db"; // createPool() แบบ callback

// export const router = express.Router();

// type Mode = "ALL" | "SOLD_ONLY";

// type Body = {
//   mode?: Mode;                 // "ALL" (สุ่มอิสระ) | "SOLD_ONLY" (เฉพาะที่ขายแล้ว) default: "ALL"
//   unique_exact?: boolean;      // กันเลขรางวัลที่ 1–3 ซ้ำกันไหม (default: true)
//   prize1_amount?: number;      // เงินรางวัล (ไม่ส่ง = 0)
//   prize2_amount?: number;
//   prize3_amount?: number;
//   last3_amount?: number;
//   last2_amount?: number;
// };

// const pad = (n: number, w: number) => n.toString().padStart(w, "0");
// const rnd = (max: number) => crypto.randomInt(0, max);

// router.post("/", (req, res) => {
//   const drawNumber = Number(req.params.drawNumber);
//   if (!Number.isInteger(drawNumber) || drawNumber <= 0) {
//     res.status(400).json({ message: "invalid draw_number" });
//     return;
//   }

//   const b: Body = req.body ?? {};
//   const mode: Mode = (b.mode as Mode) || "ALL";
//   const unique = b.unique_exact ?? true;

//   const amount1 = Number(b.prize1_amount ?? 0);
//   const amount2 = Number(b.prize2_amount ?? 0);
//   const amount3 = Number(b.prize3_amount ?? 0);
//   const amountL3 = Number(b.last3_amount  ?? 0);
//   const amountL2 = Number(b.last2_amount  ?? 0);

//   // 1) หา draw ที่ต้องปิด
//   conn.execute(
//     `SELECT id, status FROM draws WHERE draw_number=? LIMIT 1`,
//     [drawNumber],
//     (err, rows) => {
//       if (err) {
//         console.error("DB Error(find draw):", (err as any).sqlMessage || err.message || err);
//         res.status(500).json({ message: "DB Error" });
//         return;
//       }
//       const row = (rows as any[])[0];
//       if (!row) {
//         res.status(404).json({ message: "draw not found" });
//         return;
//       }
//       if (row.status !== "OPEN") {
//         res.status(409).json({ message: "draw already closed" });
//         return;
//       }
//       const drawId = row.id as number;

//       // ฟังก์ชันปิดงวดหลังเลือกเลขได้แล้ว
//       const finalize = (first: string, second: string, third: string) => {
//         const last3 = first.slice(-3);
//         const last2 = pad(rnd(100), 2);

//         const sqlUpdate = `
//           UPDATE draws
//           SET status='CLOSED',
//               closed_at=NOW(),
//               win1_full=?, win2_full=?, win3_full=?, win_last3=?, win_last2=?,
//               prize1_amount=?, prize2_amount=?, prize3_amount=?, last3_amount=?, last2_amount=?
//           WHERE id=? AND status='OPEN'
//         `;
//         const params = [
//           first, second, third, last3, last2,
//           amount1, amount2, amount3, amountL3, amountL2,
//           drawId
//         ];
//         conn.execute(sqlUpdate, params, (err2, results) => {
//           if (err2) {
//             console.error("DB Error(update draw):", (err2 as any).sqlMessage || err2.message || err2);
//             res.status(500).json({ message: "DB Error" });
//             return;
//           }
//           const r = results as mysql.ResultSetHeader;
//           if (r.affectedRows === 0) {
//             res.status(409).json({ message: "draw not open or not found" });
//             return;
//           }
//           res.json({
//             message: "draw settled (closed)",
//             draw: {
//               draw_number: drawNumber,
//               status: "CLOSED",
//               results: { first, second, third, last3, last2 },
//               amounts: {
//                 prize1_amount: amount1,
//                 prize2_amount: amount2,
//                 prize3_amount: amount3,
//                 last3_amount: amountL3,
//                 last2_amount: amountL2
//               }
//             }
//           });
//         });
//       };

//       // 2) เลือกเลขตามโหมด
//       if (mode === "SOLD_ONLY") {
//         // ดึงเลขตั๋วที่ขายแล้วของงวดนี้
//         conn.execute(
//           `SELECT ticket_number FROM tickets WHERE draw_id=? AND status='SOLD'`,
//           [drawId],
//           (err3, rows2) => {
//             if (err3) {
//               console.error("DB Error(load sold tickets):", (err3 as any).sqlMessage || err3.message || err3);
//               res.status(500).json({ message: "DB Error" });
//               return;
//             }
//             const sold = (rows2 as any[]).map(r => String(r.ticket_number));
//             if (sold.length === 0) {
//               res.status(400).json({ message: "no sold tickets to draw" });
//               return;
//             }
//             if (unique && sold.length < 3) {
//               res.status(400).json({ message: "need at least 3 sold tickets for unique prizes" });
//               return;
//             }

//             // สุ่มจากรายการ sold
//             const pickFrom = (arr: string[]) => arr[rnd(arr.length)];
//             if (unique) {
//               // shuffle แล้วหยิบ 3 ตัวแรก
//               for (let i = sold.length - 1; i > 0; i--) {
//                 const j = rnd(i + 1);
//                 [sold[i], sold[j]] = [sold[j], sold[i]];
//               }
//               const [first, second, third] = sold.slice(0, 3);
//               finalize(first, second, third);
//             } else {
//               const first = pickFrom(sold);
//               const second = pickFrom(sold);
//               const third = pickFrom(sold);
//               finalize(first, second, third);
//             }
//           }
//         );
//       } else {
//         // โหมด ALL: สุ่มอิสระ 6 หลัก
//         const used = new Set<string>();
//         const pick6 = () => pad(rnd(1_000_000), 6);
//         const first = pick6(); used.add(first);
//         let second = pick6(); if (unique) while (used.has(second)) second = pick6(); used.add(second);
//         let third  = pick6(); if (unique) while (used.has(third))  third  = pick6(); used.add(third);
//         finalize(first, second, third);
//       }
//     }
//   );
// });

// export default router;
