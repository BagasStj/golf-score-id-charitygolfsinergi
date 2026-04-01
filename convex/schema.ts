import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tournaments: defineTable({
    name: v.string(),
    date: v.string(),
    status: v.union(v.literal("upcoming"), v.literal("active"), v.literal("completed")),
    courseName: v.string(),
    holesConfig: v.array(
      v.object({
        holeNumber: v.number(),
        par: v.number(),
        index: v.number(),
      })
    ),
    description: v.optional(v.string()),
  }),

  flights: defineTable({
    tournamentId: v.id("tournaments"),
    flightName: v.string(),
    flightNumber: v.number(),
    maxPlayers: v.optional(v.number()),
  }).index("by_tournament", ["tournamentId"]),

  tournament_participants: defineTable({
    tournamentId: v.id("tournaments"),
    flightId: v.id("flights"),
    name: v.string(),
    phone: v.optional(v.string()),
    bagTag: v.optional(v.string()),
    handicap: v.optional(v.number()),
    startHole: v.optional(v.number()),
    approvedHoles: v.optional(v.array(v.number())),
    scoringFinished: v.optional(v.boolean()),
    token: v.optional(v.string()),
    email: v.optional(v.string()),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_flight", ["flightId"])
    .index("by_token", ["token"]),

  scores: defineTable({
    tournamentId: v.id("tournaments"),
    playerId: v.id("tournament_participants"),
    holeNumber: v.number(),
    strokes: v.number(),
    submittedAt: v.optional(v.number()),
  })
    .index("by_player", ["playerId"])
    .index("by_tournament_player", ["tournamentId", "playerId"]),
});
