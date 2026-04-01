"use client";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Icon } from "@iconify/react";
import Image from "next/image";

const T = {
  primary:   "rgba(255,255,255,0.96)",
  secondary: "rgba(255,255,255,0.75)",
  muted:     "rgba(255,255,255,0.55)",
  gold:      "#c9a227",
  green:     "#4ade80",
  red:       "#f87171",
};

type Entry = {
  _id: Id<"tournament_participants">;
  name: string;
  totalStrokes: number;
  scoreToPar: number;
  holesPlayed: number;
  bagTag?: string;
};

export default function LeaderboardPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;

  const tournament = useQuery(api.tournaments.getTournamentById, { tournamentId: tournamentId as Id<"tournaments"> });
  const leaderboard = useQuery(api.scores.getTournamentLeaderboard, { tournamentId: tournamentId as Id<"tournaments"> });

  const entries = (leaderboard ?? []) as Entry[];
  const totalHoles = tournament?.holesConfig ? (() => {
    const seen = new Set<number>();
    return (tournament.holesConfig as { holeNumber: number }[]).filter((h) => { if (seen.has(h.holeNumber)) return false; seen.add(h.holeNumber); return true; }).length;
  })() : 0;

  if (!tournament) {
    return (
      <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  const top3 = entries.slice(0, 3);

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>

      {/* Sticky Header */}
      <div className="header-surface" style={{ position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Image src="/logo.png" alt="Logo" width={34} height={34} style={{ objectFit: "contain" }} />
          <div style={{ textAlign: "center" }}>
            <h1 style={{ color: T.gold, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em" }}>{tournament.name}</h1>
            <p style={{ color: T.secondary, fontSize: 11, marginTop: 1 }}>{tournament.courseName}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div className="live-dot" />
            <span style={{ color: T.secondary, fontSize: 10 }}>Live</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 48px" }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 }}>
            <Icon icon="ph:trophy-bold" style={{ fontSize: 22, color: "#c9a227" }} />
            <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>Leaderboard</h2>
          </div>
          <p style={{ color: T.secondary, fontSize: 12 }}>{entries.length} players · {totalHoles} holes · sorted by score over par</p>
        </div>

        {/* Podium */}
        {top3.length >= 3 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16, alignItems: "flex-end" }}>
            {[1, 0, 2].map((idx) => {
              const p = top3[idx] as Entry | undefined;
              if (!p) return <div key={idx} />;
              const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
              const sp = p.scoreToPar;
              const heights = [80, 64, 52];
              return (
                <div key={p._id} className="card" style={{ padding: "14px 10px", textAlign: "center", borderColor: rank === 1 ? "rgba(201,162,39,0.4)" : undefined, boxShadow: rank === 1 ? "0 8px 28px rgba(201,162,39,0.2)" : undefined, paddingTop: heights[rank - 1], transition: "padding 0.3s" }}>
                  <div style={{ fontSize: rank === 1 ? 28 : rank === 2 ? 24 : 20, marginBottom: 8 }}>
                    <Icon icon={rank === 1 ? "ph:medal-bold" : "ph:star-bold"} style={{ color: rank === 1 ? "#f59e0b" : rank === 2 ? "#9ca3af" : "#92400e" }} />
                  </div>
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: 11, lineHeight: 1.3, marginBottom: 6, wordBreak: "break-word" }}>{p.name}</p>
                  <p style={{ fontWeight: 900, fontSize: rank === 1 ? 22 : 18, color: sp < 0 ? T.green : sp > 0 ? T.red : T.secondary }}>
                    {sp === 0 ? "E" : sp > 0 ? `+${sp}` : sp}
                  </p>
                  <p style={{ color: T.secondary, fontSize: 10, marginTop: 2 }}>{p.totalStrokes} str</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.25)" }}>
            <Icon icon="ph:list-numbers-bold" style={{ fontSize: 15, color: T.gold }} />
            <span style={{ color: T.gold, fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>All Players</span>
          </div>

          {entries.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <Icon icon="ph:golf-bold" style={{ fontSize: 40, color: "rgba(255,255,255,0.2)", display: "block", margin: "0 auto 12px" }} />
              <p style={{ color: T.secondary, fontSize: 13 }}>No scores yet</p>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 60px 56px 60px", gap: 0, background: "rgba(0,0,0,0.25)", padding: "7px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["#","Player","Over","Str","Holes"].map((h, i) => (
                  <div key={h} style={{ color: T.secondary, fontSize: 10, fontWeight: 700, textAlign: i > 1 ? "center" : "left" }}>{h}</div>
                ))}
              </div>
              {entries.map((p, i) => {
                const sp = p.scoreToPar;
                return (
                  <div key={p._id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 60px 56px 60px", gap: 0, padding: "13px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "center" }}>
                    {/* Rank */}
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#92400e" : "rgba(255,255,255,0.06)", color: i < 3 ? "#000" : T.secondary, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {i + 1}
                    </div>
                    {/* Name */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: T.primary, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      {p.bagTag && <div style={{ color: T.muted, fontSize: 10 }}>Bag: {p.bagTag}</div>}
                    </div>
                    {/* Over/Under */}
                    <div style={{ textAlign: "center", fontWeight: 900, fontSize: 17, color: sp < 0 ? T.green : sp > 0 ? T.red : T.secondary }}>
                      {p.holesPlayed === 0 ? "—" : sp === 0 ? "E" : sp > 0 ? `+${sp}` : sp}
                    </div>
                    {/* Strokes */}
                    <div style={{ textAlign: "center", color: T.secondary, fontWeight: 600, fontSize: 13 }}>
                      {p.holesPlayed === 0 ? "—" : p.totalStrokes}
                    </div>
                    {/* Holes */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: T.secondary, fontSize: 11 }}>{p.holesPlayed}/{totalHoles}</div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 3 }}>
                        <div style={{ height: "100%", borderRadius: 2, backgroundImage: "linear-gradient(to right,#c9a227,#e8c84a)", width: `${totalHoles > 0 ? (p.holesPlayed / totalHoles) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 11, marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Icon icon="ph:lightning-bold" style={{ fontSize: 12 }} /> Real-time via Convex
        </p>
      </div>
    </div>
  );
}
