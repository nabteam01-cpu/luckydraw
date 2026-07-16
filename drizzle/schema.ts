import { int, longtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Lucky Draw System Tables ───

/**
 * 抽獎房間
 */
export const rooms = mysqlTable("rooms", {
  id: int("id").autoincrement().primaryKey(),
  /** 房間名稱 */
  name: varchar("name", { length: 200 }).notNull(),
  /** 房間狀態：active 進行中 / closed 已關閉 */
  status: mysqlEnum("status", ["active", "closed"]).default("active").notNull(),
  /** 房間邀請碼，觀看者透過此碼加入 */
  code: varchar("code", { length: 20 }).notNull().unique(),
  /** 號碼範圍上限 */
  maxNumber: int("maxNumber").default(100).notNull(),
  /** 建立者 openId */
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
});

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = typeof rooms.$inferInsert;

/**
 * 獎品
 */
export const prizes = mysqlTable("prizes", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  /** 獎品總數量 */
  quantity: int("quantity").default(1).notNull(),
  /** 排序順序 */
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Prize = typeof prizes.$inferSelect;
export type InsertPrize = typeof prizes.$inferInsert;

/**
 * 中獎記錄
 */
export const winners = mysqlTable("winners", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  prizeId: int("prizeId").notNull(),
  /** 中獎號碼 */
  number: int("number").notNull(),
  markedAt: timestamp("markedAt").defaultNow().notNull(),
});

export type Winner = typeof winners.$inferSelect;
export type InsertWinner = typeof winners.$inferInsert;

/**
 * 兌獎清冊記錄
 */
export const claimRecords = mysqlTable("claimRecords", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  winnerId: int("winnerId").notNull(),
  /** 中獎者姓名 */
  winnerName: varchar("winnerName", { length: 200 }).notNull(),
  /** 領取狀態：pending 未領取 / claimed 已領取 */
  status: mysqlEnum("status", ["pending", "claimed"]).default("pending").notNull(),
  /** 領取時間 */
  claimedAt: timestamp("claimedAt"),
  /** 領取人簽名（Base64 編碼的 PNG 圖片） */
  signature: longtext("signature"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClaimRecord = typeof claimRecords.$inferSelect;
export type InsertClaimRecord = typeof claimRecords.$inferInsert;

// ─── Relations ───
export const claimRecordsRelations = relations(claimRecords, ({ one }) => ({
  winner: one(winners, {
    fields: [claimRecords.winnerId],
    references: [winners.id],
  }),
  room: one(rooms, {
    fields: [claimRecords.roomId],
    references: [rooms.id],
  }),
}));
