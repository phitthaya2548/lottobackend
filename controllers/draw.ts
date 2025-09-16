import express from "express";
import { conn } from "../db";
import { Draw } from "../models/draw";

export const router = express.Router();

import type { RequestHandler } from "express";

const checkPrizes: RequestHandler = async (req, res) => {
  const drawNumber = Number(req.query.drawNumber ?? req.query.draw_number);
  const ticketNumber =
    typeof req.query.ticketNumber === "string"
      ? req.query.ticketNumber.trim()
      : undefined;
  const buyerId =
    req.query.buyerUserId ?? req.query.buyer_user_id
      ? Number(req.query.buyerUserId ?? req.query.buyer_user_id)
      : undefined;

  // validate input mode
  if (!Number.isInteger(drawNumber) || (ticketNumber == null && !Number.isInteger(buyerId!))) {
    res.status(400).json({
      success: false,
      message:
        "ต้องระบุ drawNumber:int และอย่างน้อยหนึ่งใน ticketNumber:string หรือ buyerUserId:int",
    });
    return;
  }

  // ดึงข้อมูลงวดจาก draw_number
  const [drawRows] = await conn
    .promise()
    .query(
      `SELECT id, status,
              win1_full, win2_full, win3_full,
              win_last3, win_last2,
              prize1_amount, prize2_amount, prize3_amount,
              last3_amount, last2_amount
       FROM draws
       WHERE draw_number = ?`,
      [drawNumber]
    );

  const draw = Array.isArray(drawRows) && drawRows[0] as any;
  if (!draw) {
    res.status(404).json({ success: false, message: "ไม่พบงวดนี้ (draw_number)" });
    return;
  }

  if (draw.status !== "CLOSED") {
    res.status(409).json({
      success: false,
      message: "งวดยังไม่ปิดประกาศผล (status != CLOSED)",
    });
    return;
  }

  // เตรียมรายการตั๋วที่จะตรวจ
  let ticketList: Array<{ ticket_number: string }> = [];

  if (ticketNumber) {
    ticketList = [{ ticket_number: ticketNumber }];
  } else if (Number.isInteger(buyerId)) {
    const [tRows] = await conn
      .promise()
      .query(
        `SELECT t.ticket_number
         FROM tickets t
         INNER JOIN draws d ON d.id = t.draw_id
         WHERE d.draw_number = ? AND t.buyer_user_id = ?`,
        [drawNumber, buyerId]
      );
    ticketList = (tRows as any[]).map(r => ({ ticket_number: r.ticket_number }));
  }

  if (ticketList.length === 0) {
    res.json({
      success: true,
      drawNumber,
      count: 0,
      results: [],
      note: "ไม่มีตั๋วให้ตรวจในเงื่อนไขที่ส่งมา",
    });
    return;
  }

  // ฟังก์ชันตรวจรางวัลใบเดียว
  type PrizeHit = {
    prize: "PRIZE1" | "PRIZE2" | "PRIZE3" | "LAST3" | "LAST2";
    amount: number;
  };

  const judgeTicket = (num: string) => {
    const n6 = (num ?? "").trim();
    const last3 = n6.slice(-3);
    const last2 = n6.slice(-2);

    const hits: PrizeHit[] = [];

    if (draw.win1_full && n6 === draw.win1_full) {
      hits.push({ prize: "PRIZE1", amount: Number(draw.prize1_amount) });
    }
    if (draw.win2_full && n6 === draw.win2_full) {
      hits.push({ prize: "PRIZE2", amount: Number(draw.prize2_amount) });
    }
    if (draw.win3_full && n6 === draw.win3_full) {
      hits.push({ prize: "PRIZE3", amount: Number(draw.prize3_amount) });
    }
    if (draw.win_last3 && last3 === draw.win_last3) {
      hits.push({ prize: "LAST3", amount: Number(draw.last3_amount) });
    }
    if (draw.win_last2 && last2 === draw.win_last2) {
      hits.push({ prize: "LAST2", amount: Number(draw.last2_amount) });
    }

    // กติกา: ได้ "รางวัลสูงสุดเพียงรายการเดียว" (ไม่บวกรวม)
    // ถ้าอยากให้บวกรวม ทดแทนด้วย reduce บวก amount ได้เลย
    const best =
      hits.length === 0
        ? null
        : hits.reduce((a, b) => (a.amount >= b.amount ? a : b));

    return {
      ticketNumber: n6,
      matched: hits.map((h) => h.prize),
      bestPrize: best?.prize ?? null,
      awardedAmount: best?.amount ?? 0,
    };
  };

  const results = ticketList.map((t) => judgeTicket(t.ticket_number));

  res.json({
    success: true,
    mode: ticketNumber ? "single" : "buyer",
    drawNumber,
    ...(buyerId != null ? { buyerUserId: buyerId } : {}),
    count: results.length,
    results,
  });
};

const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
    (req, res, next) =>
      Promise.resolve(fn(req, res, next)).catch(next);
// Route ใหม่
router.get("/prize-check", asyncHandler(checkPrizes));


router.get("/list", async (req, res) => {
  try {
    const sql = `
      SELECT
        draw_number AS drawNumber,
        DATE_FORMAT(draw_date, '%Y-%m-%d') AS drawDate
      FROM draws
      ORDER BY draw_date DESC
    `;
    const [rows] = await conn.promise().query(sql);
    res.json({ success: true, draws: rows });
  } catch (err: any) {
    console.error("SQL error:", err.sqlMessage || err.message || err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/bydate", async (req, res) => {
  try {
    const { date, drawNumber } = req.query as {
      date?: string;
      drawNumber?: string;
    };

    if (!date)
      res
        .status(400)
        .json({ success: false, message: "date is required (YYYY-MM-DD)" });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      res.status(400).json({
        success: false,
        message: "invalid date format, expected YYYY-MM-DD",
      });

    const drawNo = drawNumber ? Number(drawNumber) : undefined;
    if (drawNumber && (!Number.isInteger(drawNo) || drawNo! <= 0)) {
      res.status(400).json({ success: false, message: "invalid drawNumber" });
    }

    const sql = `
      SELECT
        draw_number AS drawNumber,
        DATE_FORMAT(draw_date, '%Y-%m-%d') AS drawDate,
        win1_full   AS prize1,
        win2_full   AS prize2,
        win3_full   AS prize3,
        win_last3   AS last3,
        win_last2   AS last2,
        prize1_amount,
        prize2_amount,
        prize3_amount,
        last3_amount,
        last2_amount
      FROM draws
      WHERE draw_date = ?
      ${drawNumber ? "AND draw_number = ?" : ""}
      LIMIT 1
    `;

    const params: any[] = [date];
    if (drawNumber) params.push(drawNo);

    const [rows] = await conn.promise().query(sql, params);
    const list = rows as any[];
    if (!list || list.length === 0)
      res.status(404).json({ success: false, message: "Not found" });

    const row = list[0];
    res.json({
      success: true,
      draw: {
        drawNumber: row.drawNumber,
        drawDate: row.drawDate,
        results: {
          first: row.prize1,
          second: row.prize2,
          third: row.prize3,
          last3: row.last3,
          last2: row.last2,
        },
        amounts: {
          prize1Amount: Number(row.prize1_amount ?? 0),
          prize2Amount: Number(row.prize2_amount ?? 0),
          prize3Amount: Number(row.prize3_amount ?? 0),
          last3Amount: Number(row.last3_amount ?? 0),
          last2Amount: Number(row.last2_amount ?? 0),
        },
      },
    });
  } catch (err: any) {
    console.error("SQL error:", err.sqlMessage || err.message || err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/", (req, res) => {
  const sql = `
      SELECT
        id, draw_number, draw_date, status,
        win1_full, win2_full, win3_full, win_last3, win_last2,
        prize1_amount, prize2_amount, prize3_amount, last3_amount, last2_amount,
        created_at, closed_at, source_mode
      FROM draws
      WHERE status = 'CLOSED'
      ORDER BY draw_number DESC
      LIMIT 1
    `;

  conn.execute(sql, [], (err, results) => {
    if (err) {
      console.error("DB Error:", (err as any).sqlMessage || err.message || err);
      res.status(500).json({ message: "Internal Server Error" });
    }

    const rows = results as Draw[];
    if (!rows || rows.length === 0) {
      res.status(404).json({ message: "ยังไม่มีผลรางวัล" });
    }

    const r = rows[0];

    res.json({
      success: true,
      draw: {
        id: r.id,
        drawNumber: r.draw_number,
        drawDate: r.draw_date,
        status: r.status,
        results: {
          first: r.win1_full,
          second: r.win2_full,
          third: r.win3_full,
          last3: r.win_last3,
          last2: r.win_last2,
        },
        amounts: {
          prize1Amount: Number(r.prize1_amount ?? 0),
          prize2Amount: Number(r.prize2_amount ?? 0),
          prize3Amount: Number(r.prize3_amount ?? 0),
          last3Amount: Number(r.last3_amount ?? 0),
          last2Amount: Number(r.last2_amount ?? 0),
        },
        meta: {
          createdAt: r.createdAt,
          closedAt: r.closedAt,
          sourceMode: r.source_mode,
        },
      },
    });
  });
});
router.post("/randomlotto", async (req, res) => {
  // ===== รับค่า (ชื่อตามเดิม) =====
  const body: Draw = (req.body ?? {}) as Draw;
  const prize1Amount = Number(body.prize1_amount ?? 0);
  const prize2Amount = Number(body.prize2_amount ?? 0);
  const prize3Amount = Number(body.prize3_amount ?? 0);
  const last3Amount = Number(body.last3_amount ?? 0);
  const last2Amount = Number(body.last2_amount ?? 0);
  const unique = Boolean(body.unique_exact ?? true);
  const sourceMode = String(body.source_mode ?? "ALL");

  // ค่าตั้งต้นของ "งวดถัดไป" (ตอนเปิดงวดใหม่)
  const nextDrawDate = req.body?.next_draw_date ?? null; // YYYY-MM-DD หรือ null = วันนี้
  const nextSourceMode = req.body?.next_source_mode ?? "ALL";
  const nextP1 = Number(req.body?.next_prize1_amount ?? 0);
  const nextP2 = Number(req.body?.next_prize2_amount ?? 0);
  const nextP3 = Number(req.body?.next_prize3_amount ?? 0);
  const nextL3 = Number(req.body?.next_last3_amount ?? 0);
  const nextL2 = Number(req.body?.next_last2_amount ?? 0);

  // ค่าตั้งต้น "bootstrap" (เผื่อไม่มีงวด OPEN ให้สร้างก่อน)
  const bootDate = req.body?.bootstrap_draw_date ?? null;
  const bootMode = req.body?.bootstrap_source_mode ?? "ALL";
  const bootP1 = Number(req.body?.bootstrap_prize1_amount ?? 0);
  const bootP2 = Number(req.body?.bootstrap_prize2_amount ?? 0);
  const bootP3 = Number(req.body?.bootstrap_prize3_amount ?? 0);
  const bootL3 = Number(req.body?.bootstrap_last3_amount ?? 0);
  const bootL2 = Number(req.body?.bootstrap_last2_amount ?? 0);

  const randomDigits = (len: number) =>
    Math.floor(Math.random() * Math.pow(10, len))
      .toString()
      .padStart(len, "0");

  const prize1 = randomDigits(6);
  let prize2 = randomDigits(6);
  let prize3 = randomDigits(6);
  if (unique) {
    while (prize2 === prize1) prize2 = randomDigits(6);
    while (prize3 === prize1 || prize3 === prize2) prize3 = randomDigits(6);
  }
  const last3 = prize1.slice(-3);
  const last2 = randomDigits(2);

  const tx = await conn.promise().getConnection();
  try {
    await tx.beginTransaction();

    // 1) หาแถว OPEN ปัจจุบัน (ล็อกไว้)
    const [openRows] = (await tx.query(
      `SELECT id, draw_number
         FROM draws
        WHERE status='OPEN'
        ORDER BY draw_date ASC, draw_number ASC
        LIMIT 1
        FOR UPDATE`
    )) as unknown as [{ id: number; draw_number: number }[], unknown];

    let open: { id: number; draw_number: number } | null = openRows[0] ?? null;

    // 1.1) ถ้าไม่มีงวด OPEN → bootstrap สร้างงวด OPEN ใหม่
    if (!open) {
      // ล็อกเรคคอร์ดเลขงวดล่าสุดกันชนกัน
      const [lastRows] = (await tx.query(
        `SELECT id, draw_number
           FROM draws
          ORDER BY draw_number DESC
          LIMIT 1
          FOR UPDATE`
      )) as unknown as [{ id: number; draw_number: number }[], unknown];

      const nextNumber = lastRows.length > 0 ? lastRows[0].draw_number + 1 : 1;

      const [insOpen] = (await tx.execute(
        `
        INSERT INTO draws (
          draw_number, draw_date, status, source_mode,
          prize1_amount, prize2_amount, prize3_amount, last3_amount, last2_amount,
          created_at
        )
        VALUES (
          ?, COALESCE(?, CURDATE()), 'OPEN', ?,
          ?, ?, ?, ?, ?,
          NOW()
        )
        `,
        [nextNumber, bootDate, bootMode, bootP1, bootP2, bootP3, bootL3, bootL2]
      )) as unknown as [{ insertId: number }, unknown];

      open = { id: insOpen.insertId, draw_number: nextNumber };
    }

    await tx.execute(
      `UPDATE draws
          SET status='CLOSED',
              win1_full=?, win2_full=?, win3_full=?, win_last3=?, win_last2=?,
              prize1_amount=?, prize2_amount=?, prize3_amount=?, last3_amount=?, last2_amount=?,
              source_mode=?,
              closed_at=NOW()
        WHERE id=?`,
      [
        prize1,
        prize2,
        prize3,
        last3,
        last2,
        prize1Amount,
        prize2Amount,
        prize3Amount,
        last3Amount,
        last2Amount,
        sourceMode,
        open.id,
      ]
    );

    // 3) เปิดงวดถัดไป (เลขงวด +1 จากที่เพิ่งปิด)
    const nextOpenNumber = open.draw_number + 1;
    // ใช้เงินรางวัลของ "งวดก่อน" เป็นค่าเริ่มต้นของงวดใหม่ (ถ้าไม่ได้ส่ง next_* มา override)
    const carryP1 = Number(req.body?.next_prize1_amount ?? prize1Amount);
    const carryP2 = Number(req.body?.next_prize2_amount ?? prize2Amount);
    const carryP3 = Number(req.body?.next_prize3_amount ?? prize3Amount);
    const carryL3 = Number(req.body?.next_last3_amount ?? last3Amount);
    const carryL2 = Number(req.body?.next_last2_amount ?? last2Amount);

    const [openIns] = (await tx.execute(
      `
  INSERT INTO draws (
    draw_number, draw_date, status, source_mode,
    prize1_amount, prize2_amount, prize3_amount, last3_amount, last2_amount,
    created_at
  )
  VALUES (
    ?, COALESCE(?, CURDATE()), 'OPEN', ?,
    ?, ?, ?, ?, ?,
    NOW()
  )
  `,
      [
        nextOpenNumber,
        nextDrawDate,
        nextSourceMode,
        carryP1,
        carryP2,
        carryP3,
        carryL3,
        carryL2,
      ]
    )) as unknown as [{ insertId: number }, unknown];

    const [oneRows] = (await tx.query(
      `
      SELECT
        id,
        draw_number AS drawNumber,
        DATE_FORMAT(draw_date, '%Y-%m-%d') AS drawDate,
        status,
        win1_full,
        win2_full,
        win3_full,
        win_last3,
        win_last2,
        prize1_amount, prize2_amount, prize3_amount, last3_amount, last2_amount,
        source_mode, created_at, closed_at
      FROM draws
      WHERE id = ?
      LIMIT 1
      `,
      [open.id]
    )) as unknown as [
        Array<{
          id: number;
          drawNumber: number;
          drawDate: string;
          status: "OPEN" | "CLOSED";
          win1_full: string | null;
          win2_full: string | null;
          win3_full: string | null;
          win_last3: string | null;
          win_last2: string | null;
          prize1_amount: number;
          prize2_amount: number;
          prize3_amount: number;
          last3_amount: number;
          last2_amount: number;
          source_mode: string;
          created_at: string;
          closed_at: string | null;
        }>,
        unknown
      ];

    await tx.commit();

    const row = oneRows[0];
    res.status(201).json({
      success: true,
      message:
        "open draw (bootstrapped if missing) closed with results, next draw opened",
      draw: {
        id: row.id,
        drawNumber: row.drawNumber,
        drawDate: row.drawDate,
        status: row.status,
        results: {
          first: row.win1_full,
          second: row.win2_full,
          third: row.win3_full,
          last3: row.win_last3,
          last2: row.win_last2,
        },
        amounts: {
          prize1Amount: Number(row.prize1_amount ?? 0),
          prize2Amount: Number(row.prize2_amount ?? 0),
          prize3Amount: Number(row.prize3_amount ?? 0),
          last3Amount: Number(row.last3_amount ?? 0),
          last2Amount: Number(row.last2_amount ?? 0),
        },
        meta: {
          sourceMode: row.source_mode,
          createdAt: row.created_at,
          closedAt: row.closed_at,
        },
      },
      nextOpen: {
        id: (openIns as any).insertId,
        drawNumber: nextOpenNumber,
        drawDate: nextDrawDate ?? "CURDATE()",
        sourceMode: nextSourceMode,
        amounts: {
          prize1Amount: nextP1,
          prize2Amount: nextP2,
          prize3Amount: nextP3,
          last3Amount: nextL3,
          last2Amount: nextL2,
        },
      },
    });
  } catch (error) {
    console.error("DB Error:", (error as any).sqlMessage || error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    try {
      tx.release();
    } catch { }
  }
});
