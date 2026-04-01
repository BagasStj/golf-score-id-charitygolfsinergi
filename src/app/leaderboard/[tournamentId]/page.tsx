"use client";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Image from "next/image";
import { Trophy } from "lucide-react";

type HoleConfig = { holeNumber: number; par: number; index: number };
type Entry = {
  _id: Id<"tournament_participants">;
  name: string;
  totalStrokes: number;
  scoreToPar: number;
  holesPlayed: number;
  bagTag?: string;
};

const RANK_COLORS = ["#f59e0b", "#9ca3af", "#92400e"];
const RANK_TEXT   = ["#000",    "#000",    "#fff"   ];

export default function LeaderboardPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;

  const tournament = useQuery(api.tournaments.getTournamentById, { tournamentId: tournamentId as Id<"tournaments"> });
  const leaderboard = useQuery(api.scores.getTournamentLeaderboard, { tournamentId: tournamentId as Id<"tournaments"> });

  const holes: HoleConfig[] = tournament?.holesConfig ?? [];
  const totalHoles = holes.length;
  const entries = (leaderboard ?? []) as Entry[];

  if (!tournament) {
    return (
      <div style={{ minHeight: "100vh", background: "#071a10", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" style={{ margin: "0 auto" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#04120a 0%,#071a10 100%)", position: "relative" }}>
      {/* Fixed bg overlay */}
      <div className="bg-golf" style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.15, pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(4,18,10,0.94)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid rgba(34,100,50,0.22)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Image src="/logo.png" alt="Logo" width={36} height={36} style={{ objectFit: "contain" }} />
          <div style={{ textAlign: "center" }}>
            <h1 style={{ color: "#c9a227", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em" }}>{tournament.name}</h1>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>{tournament.courseName} · {tournament.date}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80", animation: "spin 2s linear infinite" }} />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>Live</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 48px", position: "relative", zIndex: 1 }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
            <Trophy size={20} color="#c9a227" />
            <h2 style={{ color: "#fff", fontWeight: 800, fontSize: 24 }}>Leaderboard</h2>
            <Trophy size={20} color="#c9a227" />
          </div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>{entries.length} Peserta · {totalHoles} Hole</p>
        </div>

        {/* Top-3 podium */}
        {entries.length >= 3 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[1, 0, 2].map((idx) => {
              const p = entries[idx] as Entry | undefined;
              if (!p) return <div key={idx} />;
              const podiumRank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
              const sp = p.scoreToPar;
              return (
                <div key={p._id} className="surface" style={{ padding: "14px 10px", borderRadius: 16, textAlign: "center", border: podiumRank === 1 ? "1px solid rgba(201,162,39,0.45)" : undefined, marginTop: podiumRank === 1 ? -16 : 0, boxShadow: podiumRank === 1 ? "0 8px 32px rgba(201,162,39,0.15)" : "none" }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: RANK_COLORS[podiumRank - 1], color: RANK_TEXT[podiumRank - 1], fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", boxShadow: podiumRank === 1 ? "0 4px 16px rgba(245,158,11,0.4)" : "none" }}>
                    {["🥇","🥈","🥉"][podiumRank - 1]}
                  </div>
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: 12, lineHeight: 1.3, marginBottom: 4 }}>{p.name}</p>
                  <p style={{ fontWeight: 900, fontSize: 20, color: sp < 0 ? "#4ade80" : sp > 0 ? "#f87171" : "rgba(255,255,255,0.6)" }}>
                    {sp === 0 ? "E" : sp > 0 ? `+${sp}` : sp}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{p.totalStrokes} str</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        <div className="surface" style={{ borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(34,100,50,0.25)", display: "flex", alignItems: "center", gap: 8, background: "rgba(20,60,30,0.3)" }}>
            <Trophy size={14} color="#c9a227" />
            <span style={{ color: "#c9a227", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Semua Peserta</span>
          </div>

          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {entries.map((p, i) => {
              const sp = p.scoreToPar;
              return (
                <div key={p._id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "1px solid rgba(34,100,50,0.12)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: i < 3 ? RANK_COLORS[i] : "rgba(255,255,255,0.06)", color: i < 3 ? RANK_TEXT[i] : "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>
                      {p.holesPlayed}/{totalHoles} holes{p.bagTag ? ` · Bag: ${p.bagTag}` : ""}
                    </p>
                  </div>
                  {/* Progress mini */}
                  <div style={{ width: 36, flexShrink: 0 }}>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                      <div style={{ height: "100%", borderRadius: 2, backgroundImage: "linear-gradient(to right,#15803d,#22c55e)", width: `${totalHoles > 0 ? (p.holesPlayed / totalHoles) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontWeight: 900, fontSize: 20, color: sp < 0 ? "#4ade80" : sp > 0 ? "#f87171" : "rgba(255,255,255,0.45)", lineHeight: 1 }}>
                      {p.holesPlayed === 0 ? "—" : sp === 0 ? "E" : sp > 0 ? `+${sp}` : sp}
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>
                      {p.holesPlayed === 0 ? "" : `${p.totalStrokes} str`}
                    </p>
                  </div>
                </div>
              );
            })}
            {entries.length === 0 && (
              <div style={{ padding: 48, textAlign: "center" }}>
                <Trophy size={36} color="rgba(255,255,255,0.1)" style={{ margin: "0 auto 12px" }} />
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Belum ada skor yang diinput</p>
              </div>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 11, marginTop: 20 }}>
          ⚡ Data diperbarui realtime via Convex
        </p>
      </div>
    </div>
  );
}
