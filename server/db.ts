import { and, eq, ne, sql, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, rooms, prizes, winners, claimRecords, type Room, type Prize, type Winner, type ClaimRecord, type InsertClaimRecord } from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers (existing) ───

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Room helpers ───

function generateRoomCode(): string {
  return nanoid(8).toUpperCase();
}

export async function createRoom(name: string, maxNumber: number, ownerOpenId: string): Promise<Room> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const code = generateRoomCode();
  const [room] = await db.insert(rooms).values({
    name,
    maxNumber,
    ownerOpenId,
    code,
  }).$returningId();

  // Fetch the created room
  const created = await db.select().from(rooms).where(eq(rooms.id, room.id)).limit(1);
  return created[0]!;
}

export async function getRoomById(id: number): Promise<Room | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  return result[0];
}

export async function getRoomByCode(code: string): Promise<Room | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase())).limit(1);
  return result[0];
}

export async function getRoomsByOwner(ownerOpenId: string): Promise<Room[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rooms).where(eq(rooms.ownerOpenId, ownerOpenId)).orderBy(desc(rooms.createdAt));
}

export async function getActiveRoomsByOwner(ownerOpenId: string): Promise<Room[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rooms).where(and(eq(rooms.ownerOpenId, ownerOpenId), eq(rooms.status, "active"))).orderBy(desc(rooms.createdAt));
}

export async function getClosedRoomsByOwner(ownerOpenId: string): Promise<Room[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rooms).where(and(eq(rooms.ownerOpenId, ownerOpenId), eq(rooms.status, "closed"))).orderBy(desc(rooms.closedAt));
}

export async function closeRoom(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(rooms).set({ status: "closed", closedAt: new Date() }).where(eq(rooms.id, id));
}

export async function reopenRoom(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(rooms).set({ status: "active", closedAt: null }).where(eq(rooms.id, id));
}

export async function deleteRoom(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete winners first, then prizes, then room
  await db.delete(winners).where(eq(winners.roomId, id));
  await db.delete(prizes).where(eq(prizes.roomId, id));
  await db.delete(rooms).where(eq(rooms.id, id));
}

// ─── Prize helpers ───

export async function getPrizesByRoom(roomId: number): Promise<Prize[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prizes).where(eq(prizes.roomId, roomId)).orderBy(asc(prizes.sortOrder), asc(prizes.id));
}

export async function createPrize(roomId: number, name: string, quantity: number): Promise<Prize> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get max sortOrder
  const existing = await db.select().from(prizes).where(eq(prizes.roomId, roomId));
  const maxSort = existing.reduce((max, p) => Math.max(max, p.sortOrder), 0);

  const [prize] = await db.insert(prizes).values({
    roomId,
    name,
    quantity,
    sortOrder: maxSort + 1,
  }).$returningId();

  const created = await db.select().from(prizes).where(eq(prizes.id, prize.id)).limit(1);
  return created[0]!;
}

export async function updatePrize(id: number, data: { name?: string; quantity?: number; sortOrder?: number }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (Object.keys(updateData).length > 0) {
    await db.update(prizes).set(updateData).where(eq(prizes.id, id));
  }
}

export async function deletePrize(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete winners associated with this prize first
  await db.delete(winners).where(eq(winners.prizeId, id));
  await db.delete(prizes).where(eq(prizes.id, id));
}

// ─── Winner helpers ───

export async function getWinnersByRoom(roomId: number): Promise<Winner[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(winners).where(eq(winners.roomId, roomId)).orderBy(desc(winners.markedAt));
}

export async function getWinnersByPrize(prizeId: number): Promise<Winner[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(winners).where(eq(winners.prizeId, prizeId)).orderBy(desc(winners.markedAt));
}

export async function getWinnerByNumber(roomId: number, number: number): Promise<Winner | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(winners).where(and(eq(winners.roomId, roomId), eq(winners.number, number))).limit(1);
  return result[0];
}

export async function markWinner(roomId: number, prizeId: number, number: number): Promise<Winner> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if number already has a winner in this room
  const existing = await getWinnerByNumber(roomId, number);
  if (existing) {
    throw new Error("此號碼已中獎");
  }

  // Check prize remaining quantity
  const prizeList = await getPrizesByRoom(roomId);
  const prize = prizeList.find(p => p.id === prizeId);
  if (!prize) throw new Error("獎品不存在");

  const prizeWinners = await getWinnersByPrize(prizeId);
  if (prizeWinners.length >= prize.quantity) {
    throw new Error("此獎項已抽完");
  }

  const [winner] = await db.insert(winners).values({
    roomId,
    prizeId,
    number,
  }).$returningId();

  const created = await db.select().from(winners).where(eq(winners.id, winner.id)).limit(1);
  return created[0]!;
}

export async function unmarkWinner(winnerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(winners).where(eq(winners.id, winnerId));
}

// ─── Composite query for room state ───

export interface RoomState {
  room: Room;
  prizes: (Prize & { winners: Winner[]; remaining: number })[];
  winners: (Winner & { prizeName: string })[];
  totalWinners: number;
}

export async function getRoomState(roomId: number): Promise<RoomState | null> {
  const db = await getDb();
  if (!db) return null;

  const room = await getRoomById(roomId);
  if (!room) return null;

  const prizeList = await getPrizesByRoom(roomId);
  const winnerList = await getWinnersByRoom(roomId);

  const prizesWithWinners = prizeList.map(p => {
    const pWinners = winnerList.filter(w => w.prizeId === p.id);
    return {
      ...p,
      winners: pWinners,
      remaining: Math.max(0, p.quantity - pWinners.length),
    };
  });

  const winnersWithPrize = winnerList.map(w => {
    const prize = prizeList.find(p => p.id === w.prizeId);
    return {
      ...w,
      prizeName: prize?.name ?? "未知獎項",
    };
  });

  return {
    room,
    prizes: prizesWithWinners,
    winners: winnersWithPrize,
    totalWinners: winnerList.length,
  };
}

// ─── Claim Records helpers ───

export async function createClaimRecord(
  roomId: number,
  winnerId: number,
  winnerName: string
): Promise<ClaimRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const record: InsertClaimRecord = {
    roomId,
    winnerId,
    winnerName,
    status: "pending",
  };
  
  await db.insert(claimRecords).values(record);
  const created = await db.select().from(claimRecords)
    .where(and(eq(claimRecords.winnerId, winnerId), eq(claimRecords.roomId, roomId)))
    .orderBy(desc(claimRecords.createdAt))
    .limit(1);
  return created[0]!;
}

export async function getClaimRecordsByRoom(roomId: number): Promise<ClaimRecord[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(claimRecords)
    .where(eq(claimRecords.roomId, roomId))
    .orderBy(asc(claimRecords.createdAt));
}

export async function updateClaimRecord(
  id: number,
  data: { winnerName?: string; status?: "pending" | "claimed"; signature?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Record<string, unknown> = {};
  if (data.winnerName !== undefined) updateData.winnerName = data.winnerName;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "claimed") {
      updateData.claimedAt = new Date();
    }
  }
  if (data.signature !== undefined) updateData.signature = data.signature;
  
  if (Object.keys(updateData).length > 0) {
    await db.update(claimRecords).set(updateData).where(eq(claimRecords.id, id));
  }
}

export async function deleteClaimRecord(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(claimRecords).where(eq(claimRecords.id, id));
}
