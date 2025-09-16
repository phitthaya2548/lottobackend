import express, { Request, Response, NextFunction } from "express";
import mysql from "mysql2";
import { conn } from "../db";
import { jwtAuthen } from "../middleware/jwt";

const router = express.Router();

router.use(jwtAuthen);

router.get(
  "/me",
  (req: Request, res: Response, _next: NextFunction): void => {
    const userId = (req as any).auth?.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const sql = `
      SELECT id, username, email, phone, full_name, role,
             created_at AS createdAt, updated_at AS updatedAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `;

    conn.execute(sql, [userId], (err, rows) => {
      if (err) {
        res.status(500).json({ message: "DB Error" });
        return;
      }
      const r = rows as any[];
      if (!r || r.length === 0) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json(r[0]);
      return;
    });
  }
);

router.put(
  "/me",
  (req: Request, res: Response, _next: NextFunction): void => {
    const userId = (req as any).auth?.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { full_name, phone, email } = req.body ?? {};
    if (!full_name || typeof full_name !== "string") {
      res.status(400).json({ message: "full_name is required" });
      return;
    }
    if (!phone || typeof phone !== "string") {
      res.status(400).json({ message: "phone is required" });
      return;
    }

    const sql = `
      UPDATE users
      SET
        full_name = ?,
        phone = ?,
        ${typeof email === "string" && email.trim() ? "email = ?, " : ""}
        updated_at = CONVERT_TZ(NOW(), '+00:00', '+07:00')
      WHERE id = ?
    `;
    const params: any[] = [full_name.trim(), phone.trim()];
    if (typeof email === "string" && email.trim()) params.push(email.trim());
    params.push(userId);

    conn.execute(sql, params, (err, results) => {
      if (err) {
        if ((err as any).code === "ER_DUP_ENTRY") {
          res.status(409).json({ message: "email already exists" });
          return;
        }
        res.status(500).json({ message: "DB Error" });
        return;
      }

      const r = results as mysql.ResultSetHeader;
      if (!r.affectedRows) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      conn.execute(
        `SELECT id, username, email, phone, full_name, role,
                created_at AS createdAt, updated_at AS updatedAt
         FROM users WHERE id = ? LIMIT 1`,
        [userId],
        (e2, rows2) => {
          if (e2) {
            res.status(500).json({ message: "DB Error" });
            return;
          }
          res.json({ message: "ok", user: (rows2 as any[])[0] });
          return;
        }
      );
    });
  }
);

export default router