import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const IMPERIAL_HOLES = [
  { holeNumber: 1, par: 4, index: 15 },
  { holeNumber: 2, par: 4, index: 1 },
  { holeNumber: 3, par: 4, index: 9 },
  { holeNumber: 4, par: 4, index: 5 },
  { holeNumber: 5, par: 3, index: 13 },
  { holeNumber: 6, par: 5, index: 7 },
  { holeNumber: 7, par: 3, index: 17 },
  { holeNumber: 8, par: 4, index: 11 },
  { holeNumber: 9, par: 5, index: 3 },
  { holeNumber: 10, par: 4, index: 12 },
  { holeNumber: 11, par: 5, index: 10 },
  { holeNumber: 12, par: 4, index: 8 },
  { holeNumber: 13, par: 4, index: 4 },
  { holeNumber: 14, par: 3, index: 18 },
  { holeNumber: 15, par: 4, index: 6 },
  { holeNumber: 16, par: 3, index: 14 },
  { holeNumber: 17, par: 4, index: 16 },
  { holeNumber: 18, par: 5, index: 2 },
];

// Get or create default active tournament
export const getActiveTournament = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("tournaments")
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    return active;
  },
});

export const getTournamentById = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    return await ctx.db.get(tournamentId);
  },
});

export const listTournaments = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tournaments").order("desc").collect();
  },
});

export const createDefaultTournament = mutation({
  args: {
    name: v.string(),
    date: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { name, date, description }) => {
    const id = await ctx.db.insert("tournaments", {
      name,
      date,
      status: "active",
      courseName: "Imperial Club House",
      holesConfig: IMPERIAL_HOLES,
      description,
    });

    // Create default Flight A
    const flightId = await ctx.db.insert("flights", {
      tournamentId: id,
      flightName: "Flight A",
      flightNumber: 1,
      maxPlayers: 4,
    });

    return { tournamentId: id, flightId };
  },
});

export const seedTournament = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if active tournament already exists
    const existing = await ctx.db
      .query("tournaments")
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (existing) return { tournamentId: existing._id, alreadyExists: true };

    const id = await ctx.db.insert("tournaments", {
      name: "Charity Golf Sinergi",
      date: new Date().toISOString().split("T")[0],
      status: "active",
      courseName: "Imperial Club House",
      holesConfig: IMPERIAL_HOLES,
      description: "Imperial Klub Golf · Lippo Village",
    });

    await ctx.db.insert("flights", {
      tournamentId: id,
      flightName: "Flight A",
      flightNumber: 1,
      maxPlayers: 4,
    });

    return { tournamentId: id, alreadyExists: false };
  },
});
