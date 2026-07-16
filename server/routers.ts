import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { claimRecords } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ─── Lucky Draw: Room management ───
  rooms: router({
    // 取得主辦人的所有房間（含進行中 + 已關閉）
    list: protectedProcedure.query(({ ctx }) =>
      db.getRoomsByOwner(ctx.user.openId)
    ),

    // 取得進行中的房間
    active: protectedProcedure.query(({ ctx }) =>
      db.getActiveRoomsByOwner(ctx.user.openId)
    ),

    // 取得已關閉的房間
    closed: protectedProcedure.query(({ ctx }) =>
      db.getClosedRoomsByOwner(ctx.user.openId)
    ),

    // 建立新房間
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(200),
        maxNumber: z.number().int().min(1).max(99999).default(100),
      }))
      .mutation(({ ctx, input }) =>
        db.createRoom(input.name, input.maxNumber, ctx.user.openId)
      ),

    // 取得房間完整狀態（主辦人用）
    getState: protectedProcedure
      .input(z.object({ roomId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權存取此房間");
        return db.getRoomState(input.roomId);
      }),

    // 關閉房間
    close: protectedProcedure
      .input(z.object({ roomId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此房間");
        await db.closeRoom(input.roomId);
        return { success: true };
      }),

    // 重新開啟房間
    reopen: protectedProcedure
      .input(z.object({ roomId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此房間");
        await db.reopenRoom(input.roomId);
        return { success: true };
      }),

    // 刪除房間
    delete: protectedProcedure
      .input(z.object({ roomId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此房間");
        await db.deleteRoom(input.roomId);
        return { success: true };
      }),
  }),

  // ─── Lucky Draw: Prize management ───
  prizes: router({
    // 新增獎品
    create: protectedProcedure
      .input(z.object({
        roomId: z.number().int(),
        name: z.string().min(1).max(200),
        quantity: z.number().int().min(1).max(99999).default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此房間");
        return db.createPrize(input.roomId, input.name, input.quantity);
      }),

    // 更新獎品（內嵌編輯用）
    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        name: z.string().min(1).max(200).optional(),
        quantity: z.number().int().min(1).max(99999).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 驗證獎品所屬房間的所有權
        const allRooms = await db.getRoomsByOwner(ctx.user.openId);
        let found = false;
        for (const room of allRooms) {
          const roomPrizes = await db.getPrizesByRoom(room.id);
          if (roomPrizes.some(p => p.id === input.id)) {
            found = true;
            break;
          }
        }
        if (!found) throw new Error("無權操作此獎品");
        await db.updatePrize(input.id, { name: input.name, quantity: input.quantity });
        return { success: true };
      }),

    // 刪除獎品
    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        // 驗證獎品所屬房間的所有權
        const allRooms = await db.getRoomsByOwner(ctx.user.openId);
        let found = false;
        for (const room of allRooms) {
          const roomPrizes = await db.getPrizesByRoom(room.id);
          if (roomPrizes.some(p => p.id === input.id)) {
            found = true;
            break;
          }
        }
        if (!found) throw new Error("無權操作此獎品");
        await db.deletePrize(input.id);
        return { success: true };
      }),

    // 重新排序獎品
    reorder: protectedProcedure
      .input(z.object({
        roomId: z.number().int(),
        prizes: z.array(z.object({
          id: z.number().int(),
          sortOrder: z.number().int(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此房間");
        for (const prize of input.prizes) {
          await db.updatePrize(prize.id, { sortOrder: prize.sortOrder });
        }
        return { success: true };
      }),

    // 從 Excel 匯入獎品
    importFromExcel: protectedProcedure
      .input(z.object({
        roomId: z.number().int(),
        prizes: z.array(z.object({
          name: z.string().min(1).max(200),
          quantity: z.number().int().min(1).max(99999),
          remark: z.string().max(500).optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此房間");
        
        const results = [];
        for (const prize of input.prizes) {
          try {
            const created = await db.createPrize(input.roomId, prize.name, prize.quantity);
            results.push({ success: true, name: prize.name, id: created.id });
          } catch (error) {
            results.push({ success: false, name: prize.name, error: (error as Error).message });
          }
        }
        return { results, totalCount: input.prizes.length, successCount: results.filter(r => r.success).length };
      }),
  }),

  // ─── Lucky Draw: Winner management ───
  winners: router({
    // 標記中獎號碼
    mark: protectedProcedure
      .input(z.object({
        roomId: z.number().int(),
        prizeId: z.number().int(),
        number: z.number().int().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此房間");
        if (input.number > room.maxNumber) throw new Error("號碼超出範圍");
        return db.markWinner(input.roomId, input.prizeId, input.number);
      }),

    // 撤銷中獎標記
    unmark: protectedProcedure
      .input(z.object({ winnerId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        // 驗證中獎記錄所屬房間的所有權
        const allRooms = await db.getRoomsByOwner(ctx.user.openId);
        let found = false;
        for (const room of allRooms) {
          const roomWinners = await db.getWinnersByRoom(room.id);
          if (roomWinners.some(w => w.id === input.winnerId)) {
            found = true;
            break;
          }
        }
        if (!found) throw new Error("無權操作此中獎記錄");
        await db.unmarkWinner(input.winnerId);
        return { success: true };
      }),

    // 隨機產生未中獎號碼
    random: protectedProcedure
      .input(z.object({
        roomId: z.number().int(),
      }))
      .query(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此房間");

        const winners = await db.getWinnersByRoom(input.roomId);
        const usedNumbers = new Set(winners.map(w => w.number));
        const availableNumbers: number[] = [];

        for (let i = 1; i <= room.maxNumber; i++) {
          if (!usedNumbers.has(i)) {
            availableNumbers.push(i);
          }
        }

        if (availableNumbers.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        return availableNumbers[randomIndex];
      }),
  }),

  // ─── Lucky Draw: Viewer (觀看者) ───
  viewer: router({
    // 透過房間碼取得房間狀態（觀看者用，公開端點）
    getState: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const room = await db.getRoomByCode(input.code);
        if (!room) throw new Error("房間不存在");
        const state = await db.getRoomState(room.id);
        if (!state) throw new Error("房間狀態取得失敗");
        return state;
      }),
  }),

  // ─── Lucky Draw: Claim Records (兌獎清冊) ───
  claims: router({
    // 取得房間的兌獎清冊
    list: protectedProcedure
      .input(z.object({ roomId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權存取此房間");
        return db.getClaimRecordsByRoom(input.roomId);
      }),

    // 新增兌獎記錄
    create: protectedProcedure
      .input(z.object({
        roomId: z.number().int(),
        winnerId: z.number().int(),
        winnerName: z.string().min(1).max(200),
      }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此房間");
        return db.createClaimRecord(input.roomId, input.winnerId, input.winnerName);
      }),

    // 更新兌獎記錄
    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        winnerName: z.string().min(1).max(200).optional(),
        status: z.enum(["pending", "claimed"]).optional(),
        signature: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 驗證記錄所屬房間的所有權
        const record = await db.getDb().then(database => {
          if (!database) return null;
          return database.select().from(claimRecords)
            .where(eq(claimRecords.id, input.id))
            .limit(1)
            .then(r => r[0]);
        });
        if (!record) throw new Error("記錄不存在");
        
        const room = await db.getRoomById(record.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此記錄");
        
        await db.updateClaimRecord(input.id, {
          winnerName: input.winnerName,
          status: input.status,
          signature: input.signature,
        });
        return { success: true };
      }),

    // 刪除兌獎記錄
    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        // 驗證記錄所屬房間的所有權
        const record = await db.getDb().then(db => {
          if (!db) return null;
          return db.select().from(require("../drizzle/schema").claimRecords)
            .where(require("drizzle-orm").eq(require("../drizzle/schema").claimRecords.id, input.id))
            .limit(1)
            .then(r => r[0]);
        });
        if (!record) throw new Error("記錄不存在");
        
        const room = await db.getRoomById(record.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權操作此記錄");
        
        await db.deleteClaimRecord(input.id);
        return { success: true };
      }),
  }),

  // ─── Lucky Draw: Export (匯出) ───
  export: router({
    // 匯出中獎名單為 CSV 格式
    winners: protectedProcedure
      .input(z.object({ roomId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        // 驗證房間所有權
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權存取此房間");

        // 取得房間的所有中獎記錄
        const winners = await db.getWinnersByRoom(input.roomId);
        const prizes = await db.getPrizesByRoom(input.roomId);

        // 標正化中獎記錄中的獎品名稱
        const prizeMap = new Map(prizes.map(p => [p.id, p.name]));
        const winnersWithPrizeName = winners.map(w => ({
          ...w,
          prizeName: prizeMap.get(w.prizeId) || "未知獎品",
        }));

        // 產生 CSV 內容
        const csv = generateWinnersCSV(room.name, winnersWithPrizeName);
        return { csv, roomName: room.name, count: winners.length };
      }),

    // 匯出兌獎清冊為 CSV 格式
    claims: protectedProcedure
      .input(z.object({ roomId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        // 驗證房間所有權
        const room = await db.getRoomById(input.roomId);
        if (!room) throw new Error("房間不存在");
        if (room.ownerOpenId !== ctx.user.openId) throw new Error("無權存取此房間");

        // 取得房間的所有兌獎記錄
        const records = await db.getClaimRecordsByRoom(input.roomId);

        // 產生 CSV、HTML 和 PDF 內容
        const csv = generateClaimsCSV(room.name, records);
        const html = generateClaimsHTML(room.name, records);
        const pdf = generateClaimsPDF(room.name, records);
        return { csv, html, pdf, roomName: room.name, count: records.length };
      }),
  }),
});

// 輔助函數：產生 CSV 內容
function generateWinnersCSV(
  roomName: string,
  winners: Array<{ number: number; prizeId: number; prizeName: string; markedAt: Date }>
): string {
  const headers = ["中獎號碼", "獎品名稱", "標記時間"];
  const rows = winners.map(w => [
    String(w.number),
    w.prizeName,
    new Date(w.markedAt).toLocaleString("zh-TW"),
  ]);

  // 標項列
  const headerRow = headers.map(h => `"${h}"`).join(",");

  // 數據列（需要逸出不常見的逗號和換行）
  const dataRows = rows.map(row =>
    row.map(cell => {
      // 如果數據中含有逗號、雙引號或換行，需要用雙引號包住
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return `"${cell}"`;
    }).join(",")
  );

  // 組合標項列和數據列
  const csv = [headerRow, ...dataRows].join("\n");
    // 加入 UTF-8 BOM，確保 Excel 正確識別中文編碼
  return "\uFEFF" + csv;
}

// 輔助函數：產生兌獎清冊 CSV 內容
function generateClaimsCSV(
  roomName: string,
  records: Array<{ id: number; winnerId: number; winnerName: string; status: "pending" | "claimed"; claimedAt: Date | null; createdAt: Date; signature: string | null }>
): string {
  const headers = ["中獎者姓名", "領取狀態", "領取時間", "簽名", "記錄時間"];
  const rows = records.map(r => [
    r.winnerName,
    r.status === "claimed" ? "已領取" : "未領取",
    r.claimedAt ? new Date(r.claimedAt).toLocaleString("zh-TW") : "-",
    r.signature ? "[簽名圖片]" : "-",
    new Date(r.createdAt).toLocaleString("zh-TW"),
  ]);

  // 標項列
  const headerRow = headers.map(h => `"${h}"`).join(",");

  // 數據列（需要逸出不常見的逗號和換行）
  const dataRows = rows.map(row =>
    row.map(cell => {
      // 如果數據中含有逗號、雙引號或換行，需要用雙引號包住
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return `"${cell}"`;
    }).join(",")
  );

  // 組合標項列和數據列
  const csv = [headerRow, ...dataRows].join("\n");
  // 加入 UTF-8 BOM，確保 Excel 正確識別中文編碼
  return "\uFEFF" + csv;
}

export type AppRouter = typeof appRouter;

// 輔助函數：產生兌獎清冊 HTML 內容（包含簽名縮圖）
function generateClaimsHTML(
  roomName: string,
  records: Array<{ id: number; winnerId: number; winnerName: string; status: "pending" | "claimed"; claimedAt: Date | null; createdAt: Date; signature: string | null }>
): string {
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${roomName} - 兌獎清冊</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { text-align: center; color: #333; margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background-color: #f0f0f0; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: bold; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    tr:hover { background-color: #f9f9f9; }
    .status-claimed { color: #28a745; font-weight: bold; }
    .status-pending { color: #dc3545; font-weight: bold; }
    .signature-img { max-width: 100px; max-height: 50px; border: 1px solid #ddd; border-radius: 4px; }
    .no-signature { color: #999; }
    .timestamp { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${roomName} - 兌獎清冊</h1>
    <p class="timestamp">生成時間：${new Date().toLocaleString("zh-TW")}</p>
    <table>
      <thead>
        <tr>
          <th>序號</th>
          <th>中獎者姓名</th>
          <th>領取狀態</th>
          <th>領取時間</th>
          <th>簽名</th>
          <th>記錄時間</th>
        </tr>
      </thead>
      <tbody>
        ${records.map((r, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${r.winnerName}</td>
          <td class="${r.status === "claimed" ? "status-claimed" : "status-pending"}">
            ${r.status === "claimed" ? "已領取" : "未領取"}
          </td>
          <td>${r.claimedAt ? new Date(r.claimedAt).toLocaleString("zh-TW") : "-"}</td>
          <td>
            ${r.signature ? `<img src="${r.signature}" alt="簽名" class="signature-img" title="簽名">` : '<span class="no-signature">未簽名</span>'}
          </td>
          <td class="timestamp">${new Date(r.createdAt).toLocaleString("zh-TW")}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
    <p style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
      共 ${records.length} 筆記錄 | 已領取：${records.filter(r => r.status === "claimed").length} 筆 | 未領取：${records.filter(r => r.status === "pending").length} 筆
    </p>
  </div>
</body>
</html>
  `;
  return html;
}


// 輔助函數：產生兌獎清冊 PDF 內容（使用 HTML 轉 PDF）
function generateClaimsPDF(
  roomName: string,
  records: Array<{ id: number; winnerId: number; winnerName: string; status: "pending" | "claimed"; claimedAt: Date | null; createdAt: Date; signature: string | null }>
): string {
  // 產生 HTML 內容
  const html = generateClaimsHTML(roomName, records);
  
  // 將 HTML 編碼為 Base64，供前端使用 html2pdf 轉換
  // 前端會使用 html2pdf.js 庫來將 HTML 轉換為 PDF
  return Buffer.from(html).toString("base64");
}
