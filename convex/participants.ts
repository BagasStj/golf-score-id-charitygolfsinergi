import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const registerPlayer = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
    phone: v.string(),
    bagTag: v.string(), // required, must be unique
  },
  handler: async (ctx, { tournamentId, name, phone, bagTag }) => {
    // Validate uniqueness within tournament
    const participants = await ctx.db
      .query("tournament_participants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();

    const tName = name.trim().toLowerCase();
    const tPhone = phone.trim();
    const tBagTag = bagTag.trim();

    if (participants.some((p) => p.bagTag === tBagTag)) {
      throw new ConvexError(`Nomor bag tag "${tBagTag}" sudah terdaftar. Gunakan nomor bag tag yang berbeda.`);
    }
    if (participants.some((p) => p.name.toLowerCase() === tName)) {
      throw new ConvexError(`Nama "${name.trim()}" sudah terdaftar. Gunakan nama yang berbeda (atau login dengan nama tersebut).`);
    }
    if (participants.some((p) => p.phone === tPhone)) {
      throw new ConvexError(`Nomor HP "${tPhone}" sudah terdaftar. Gunakan nomor yang berbeda (atau login).`);
    }

    // Get the single flight for this tournament (auto-create if needed)
    const flights = await ctx.db
      .query("flights")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();

    let flightId;
    if (flights.length === 0) {
      // No flight yet — create the single default flight
      flightId = await ctx.db.insert("flights", {
        tournamentId,
        flightName: "Flight",
        flightNumber: 1,
        maxPlayers: 999, // unlimited
      });
    } else {
      // Always use the first (and only) flight
      flightId = flights[0]._id;
    }

    const token = generateToken();

    const participantId = await ctx.db.insert("tournament_participants", {
      tournamentId,
      flightId,
      name: name.trim(),
      phone: phone.trim(),
      bagTag: bagTag.trim(),
      startHole: 1,
      approvedHoles: [],
      scoringFinished: false,
      token,
    });

    return { participantId, token };
  },
});

export const loginPlayer = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, { tournamentId, name, phone }) => {
    const participants = await ctx.db
      .query("tournament_participants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();

    const tName = name.trim().toLowerCase();
    const tPhone = phone.trim();

    const participant = participants.find(
      (p) => p.name.toLowerCase() === tName && p.phone === tPhone
    );

    if (!participant) {
      throw new ConvexError("Pemain tidak ditemukan atau nomor handphone salah.");
    }

    return { participantId: participant._id, token: participant.token };
  },
});

export const getParticipantByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query("tournament_participants")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
  },
});

export const getParticipantById = query({
  args: { participantId: v.id("tournament_participants") },
  handler: async (ctx, { participantId }) => {
    return await ctx.db.get(participantId);
  },
});

export const listParticipants = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    return await ctx.db
      .query("tournament_participants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
  },
});

export const updateParticipantEmail = mutation({
  args: {
    participantId: v.id("tournament_participants"),
    email: v.string(),
  },
  handler: async (ctx, { participantId, email }) => {
    await ctx.db.patch(participantId, { email });
  },
});
