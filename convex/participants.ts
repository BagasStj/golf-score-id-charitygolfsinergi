import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const registerPlayer = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    name: v.string(),
    phone: v.optional(v.string()),
    bagTag: v.string(), // required, must be unique
  },
  handler: async (ctx, { tournamentId, name, phone, bagTag }) => {
    // Validate bag tag uniqueness within tournament
    const existingBagTag = await ctx.db
      .query("tournament_participants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .filter((q) => q.eq(q.field("bagTag"), bagTag))
      .first();

    if (existingBagTag) {
      throw new Error(`Nomor bag tag "${bagTag}" sudah terdaftar. Gunakan nomor bag tag yang berbeda.`);
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
      phone: phone?.trim() || undefined,
      bagTag: bagTag.trim(),
      startHole: 1,
      approvedHoles: [],
      scoringFinished: false,
      token,
    });

    return { participantId, token };
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
