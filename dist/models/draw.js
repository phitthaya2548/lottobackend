"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Draw = void 0;
class Draw {
    constructor(draw_number, draw_date, status = "OPEN", opts) {
        this.id = opts?.id;
        this.draw_number = draw_number;
        this.draw_date = draw_date;
        this.status = status;
        this.source_mode = opts?.source_mode ?? "ALL";
        this.win1_full = opts?.win1_full ?? null;
        this.win2_full = opts?.win2_full ?? null;
        this.win3_full = opts?.win3_full ?? null;
        this.win_last3 = opts?.win_last3 ?? null;
        this.win_last2 = opts?.win_last2 ?? null;
        this.unique_exact = opts?.unique_exact ?? true;
        this.prize1_amount = opts?.prize1_amount ?? 0;
        this.prize2_amount = opts?.prize2_amount ?? 0;
        this.prize3_amount = opts?.prize3_amount ?? 0;
        this.last3_amount = opts?.last3_amount ?? 0;
        this.last2_amount = opts?.last2_amount ?? 0;
        this.createdAt = opts?.createdAt ?? new Date();
        this.closedAt = opts?.closedAt ?? null;
    }
    toInsertParams(statusOverride) {
        return [
            this.draw_number,
            this.draw_date,
            statusOverride ?? this.status,
            this.source_mode,
            this.win1_full,
            this.win2_full,
            this.win3_full,
            this.win_last3,
            this.win_last2,
            this.prize1_amount,
            this.prize2_amount,
            this.prize3_amount,
            this.last3_amount,
            this.last2_amount,
        ];
    }
}
exports.Draw = Draw;
