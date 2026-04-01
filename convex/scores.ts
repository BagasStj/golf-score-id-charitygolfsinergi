import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const submitScore = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    playerId: v.id("tournament_participants"),
    holeNumber: v.number(),
    strokes: v.number(),
  },
  handler: async (ctx, { tournamentId, playerId, holeNumber, strokes }) => {
    // Check if score already exists
    const existing = await ctx.db
      .query("scores")
      .withIndex("by_tournament_player", (q) =>
        q.eq("tournamentId", tournamentId).eq("playerId", playerId)
      )
      .filter((q) => q.eq(q.field("holeNumber"), holeNumber))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { strokes, submittedAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert("scores", {
      tournamentId,
      playerId,
      holeNumber,
      strokes,
      submittedAt: Date.now(),
    });
  },
});

export const updateScore = mutation({
  args: {
    scoreId: v.id("scores"),
    playerId: v.id("tournament_participants"),
    newStrokes: v.number(),
  },
  handler: async (ctx, { scoreId, newStrokes }) => {
    await ctx.db.patch(scoreId, { strokes: newStrokes, submittedAt: Date.now() });
  },
});

export const deleteScore = mutation({
  args: {
    scoreId: v.id("scores"),
    playerId: v.id("tournament_participants"),
  },
  handler: async (ctx, { scoreId }) => {
    await ctx.db.delete(scoreId);
  },
});

export const getPlayerScores = query({
  args: {
    tournamentId: v.id("tournaments"),
    playerId: v.id("tournament_participants"),
  },
  handler: async (ctx, { tournamentId, playerId }) => {
    return await ctx.db
      .query("scores")
      .withIndex("by_tournament_player", (q) =>
        q.eq("tournamentId", tournamentId).eq("playerId", playerId)
      )
      .collect();
  },
});

export const getFlightScores = query({
  args: {
    tournamentId: v.id("tournaments"),
    playerIds: v.array(v.id("tournament_participants")),
  },
  handler: async (ctx, { tournamentId, playerIds }) => {
    const results = await Promise.all(
      playerIds.map(async (playerId) => {
        const scores = await ctx.db
          .query("scores")
          .withIndex("by_tournament_player", (q) =>
            q.eq("tournamentId", tournamentId).eq("playerId", playerId)
          )
          .collect();
        return { playerId, scores };
      })
    );
    return results;
  },
});

export const getTournamentLeaderboard = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    const participants = await ctx.db
      .query("tournament_participants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();

    const tournament = await ctx.db.get(tournamentId);
    const holesConfig = tournament?.holesConfig || [];

    const results = await Promise.all(
      participants.map(async (p) => {
        const scores = await ctx.db
          .query("scores")
          .withIndex("by_tournament_player", (q) =>
            q.eq("tournamentId", tournamentId).eq("playerId", p._id)
          )
          .collect();

        const totalStrokes = scores.reduce((sum, s) => sum + s.strokes, 0);
        const playedHolesPar = scores.reduce((sum, s) => {
          const hole = holesConfig.find((h) => h.holeNumber === s.holeNumber);
          return sum + (hole?.par || 0);
        }, 0);
        const holesPlayed = scores.length;
        const scoreToPar = holesPlayed > 0 ? totalStrokes - playedHolesPar : 0;

        return {
          ...p,
          scores,
          totalStrokes,
          scoreToPar,
          holesPlayed,
        };
      })
    );

    return results.sort((a, b) => {
      if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
      if (a.holesPlayed === 0) return 1;
      if (b.holesPlayed === 0) return -1;
      return a.totalStrokes - b.totalStrokes;
    });
  },
});
