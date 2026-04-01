import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getFlightsByTournament = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    return await ctx.db
      .query("flights")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
  },
});

export const getFlightDetails = query({
  args: { flightId: v.id("flights") },
  handler: async (ctx, { flightId }) => {
    const flight = await ctx.db.get(flightId);
    if (!flight) return null;

    const participants = await ctx.db
      .query("tournament_participants")
      .withIndex("by_flight", (q) => q.eq("flightId", flightId))
      .collect();

    return { ...flight, participants };
  },
});

export const getPlayerFlight = query({
  args: { playerId: v.id("tournament_participants") },
  handler: async (ctx, { playerId }) => {
    const participant = await ctx.db.get(playerId);
    if (!participant) return null;

    const flight = await ctx.db.get(participant.flightId);
    if (!flight) return null;

    const participants = await ctx.db
      .query("tournament_participants")
      .withIndex("by_flight", (q) => q.eq("flightId", participant.flightId))
      .collect();

    return { ...flight, participants };
  },
});

export const getTournamentFlightsWithParticipants = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    const flights = await ctx.db
      .query("flights")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();

    const result = await Promise.all(
      flights.map(async (flight) => {
        const participants = await ctx.db
          .query("tournament_participants")
          .withIndex("by_flight", (q) => q.eq("flightId", flight._id))
          .collect();
        return { ...flight, participants };
      })
    );

    return result;
  },
});

export const approveHole = mutation({
  args: {
    playerId: v.id("tournament_participants"),
    holeNumber: v.number(),
  },
  handler: async (ctx, { playerId, holeNumber }) => {
    const participant = await ctx.db.get(playerId);
    if (!participant) throw new Error("Participant not found");

    const current = participant.approvedHoles || [];
    if (!current.includes(holeNumber)) {
      await ctx.db.patch(playerId, {
        approvedHoles: [...current, holeNumber],
      });
    }
  },
});

export const finishScoring = mutation({
  args: { playerId: v.id("tournament_participants") },
  handler: async (ctx, { playerId }) => {
    await ctx.db.patch(playerId, { scoringFinished: true });
  },
});

export const createFlight = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    flightName: v.string(),
    flightNumber: v.number(),
    maxPlayers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("flights", args);
  },
});
