"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Icon } from "@iconify/react";
import Image from "next/image";

type HoleConfig = { holeNumber: number; par: number; index: number };
type Score = { _id: Id<"scores">; holeNumber: number; strokes: number; submittedAt?: number };

const T = {
  primary:   "rgba(255,255,255,0.95)",
  secondary: "rgba(255,255,255,0.70)",
  muted:     "rgba(255,255,255,0.45)",
  gold:      "#e8c84a",
  green:     "#4ade80",
  red:       "#f87171",
};

const quick = [
  { label: "Eagle",  bg: "#fbbf24", color: "#000", offset: -2 },
  { label: "Birdie", bg: "#22c55e", color: "#000", offset: -1 },
  { label: "Par",    bg: "#ffffff", color: "#000", offset:  0 },
  { label: "Bogey",  bg: "#DE1A58", color: "#fff", offset:  1 },
  { label: "Double", bg: "#CF0F0F", color: "#fff", offset:  2 },
];

export default function ScoringHolePage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.tournamentId as string;
  const holeNum = parseInt(params.hole as string, 10);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [strokes,  setStrokes]  = useState(4);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDel,  setShowDel]  = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    const id  = localStorage.getItem("playerId");
    const tid = localStorage.getItem("tournamentId");
    if (!id || tid !== tournamentId) { router.replace("/register"); return; }
    setPlayerId(id);
  }, [tournamentId, router]);

  const tournament   = useQuery(api.tournaments.getTournamentById, { tournamentId: tournamentId as Id<"tournaments"> });
  const playerScores = useQuery(api.scores.getPlayerScores,
    playerId ? { tournamentId: tournamentId as Id<"tournaments">, playerId: playerId as Id<"tournament_participants"> } : "skip"
  );
  const participant = useQuery(api.participants.getParticipantById,
    playerId ? { participantId: playerId as Id<"tournament_participants"> } : "skip"
  );

  const submitScore = useMutation(api.scores.submitScore);
  const updateScore = useMutation(api.scores.updateScore);
  const deleteScore = useMutation(api.scores.deleteScore);

  const holes: HoleConfig[] = useMemo(() => {
    if (!tournament?.holesConfig) return [];
    const seen = new Set<number>();
    return tournament.holesConfig
      .filter((h: HoleConfig) => { if (seen.has(h.holeNumber)) return false; seen.add(h.holeNumber); return true; })
      .sort((a: HoleConfig, b: HoleConfig) => a.holeNumber - b.holeNumber);
  }, [tournament?.holesConfig]);

  const hole     = holes.find((h) => h.holeNumber === holeNum);
  const scores: Score[] = useMemo(() => (playerScores ?? []) as Score[], [playerScores]);
  const scoreMap = useMemo(() => new Map(scores.map((s) => [s.holeNumber, s])), [scores]);
  const existing = hole ? scoreMap.get(hole.holeNumber) : undefined;
  const isEdit   = !!existing;

  const isFinished = participant?.scoringFinished === true
    || (typeof window !== "undefined" && localStorage.getItem(`tournamentFinished_${tournamentId}_${playerId}`) === "true");

  const holesPlayed  = scores.length;
  const totalHoles   = holes.length;
  const totalStrokes = scores.reduce((s, sc) => s + sc.strokes, 0);
  const playedPar    = scores.reduce((s, sc) => { const h = holes.find((h) => h.holeNumber === sc.holeNumber); return s + (h?.par ?? 0); }, 0);
  const runningToPar = totalStrokes - playedPar;
  const progress     = totalHoles > 0 ? (holesPlayed / totalHoles) * 100 : 0;

  useEffect(() => { if (hole) setStrokes(existing?.strokes ?? hole.par); }, [hole, existing]);

  const flash = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2200);
  };

  const handleSubmit = async () => {
    if (!hole || strokes <= 0 || !playerId) return;
    setSaving(true);
    try {
      if (isEdit && existing) {
        await updateScore({ scoreId: existing._id, playerId: playerId as Id<"tournament_participants">, newStrokes: strokes });
        flash("Score updated", true);
      } else {
        await submitScore({ tournamentId: tournamentId as Id<"tournaments">, playerId: playerId as Id<"tournament_participants">, holeNumber: hole.holeNumber, strokes });
        flash("Score saved!", true);
      }
      setTimeout(() => router.push(`/scoring/${tournamentId}`), 700);
    } catch { flash("Failed to save score", false); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!existing || !playerId) return;
    setDeleting(true);
    try {
      await deleteScore({ scoreId: existing._id, playerId: playerId as Id<"tournament_participants"> });
      flash("Score deleted", true);
      setTimeout(() => router.push(`/scoring/${tournamentId}`), 700);
    } catch { flash("Failed to delete", false); }
    finally { setDeleting(false); setShowDel(false); }
  };

  /* Loading */
  if (!hole) return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" />
    </div>
  );

  /* Finished/locked */
  if (isFinished) return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 300 }}>
        <Icon icon="ph:lock-bold" style={{ fontSize: 56, color: T.gold, marginBottom: 16 }} />
        <h2 style={{ color: T.primary, fontWeight: 700, fontSize: 21, marginBottom: 8 }}>Round Complete</h2>
        <p style={{ color: T.secondary, fontSize: 13, marginBottom: 24 }}>Scoring has been finalized.</p>
        <button onClick={() => router.push(`/scoring/${tournamentId}`)} className="btn-gold">Back to Scorecard</button>
      </div>
    </div>
  );

  const curDiff = strokes - hole.par;

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, paddingBottom: 32 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "9px 22px", borderRadius: 999, fontWeight: 600, fontSize: 12, color: "#fff", background: toast.ok ? "rgba(15,80,35,0.96)" : "rgba(160,20,20,0.96)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", animation: "fadeIn 0.2s ease-out" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="header-surface" style={{ position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <button onClick={() => router.push(`/scoring/${tournamentId}`)} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <Icon icon="ph:arrow-left-bold" style={{ fontSize: 18, color: T.secondary }} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", backgroundImage: "linear-gradient(to right,#c9a227,#e8c84a)", width: `${progress}%`, transition: "width 0.5s" }} />
              </div>
              <p style={{ textAlign: "center", fontSize: 10, color: T.secondary, marginTop: 3 }}>{holesPlayed}/{totalHoles} holes</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Total</p>
                <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1, color: runningToPar < 0 ? T.green : runningToPar > 0 ? T.red : T.secondary }}>
                  {runningToPar > 0 ? `+${runningToPar}` : runningToPar === 0 ? "0" : runningToPar}
                </p>
              </div>
              <Image src="/logo.png" alt="Logo" width={26} height={26} style={{ objectFit: "contain", opacity: 0.85 }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Hole Info Card */}
        <div className="card animate-fade-in" style={{ padding: "22px 24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle,rgba(201,162,39,0.10),transparent 70%)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative" }}>
            <div>
              <p style={{ fontSize: 10, color: T.muted, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 2 }}>Hole</p>
              <p style={{ fontSize: 78, fontWeight: 900, color: T.primary, lineHeight: 0.9, letterSpacing: "-3px" }}>{hole.holeNumber}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, paddingBottom: 6 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 9, color: T.muted, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 4 }}>Par</p>
                <div style={{ width: 50, height: 50, borderRadius: 12, background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(220,38,38,0.6)" }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: "#fff" }}>{hole.par}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Icon icon="ph:flag-bold" style={{ fontSize: 13, color: T.muted }} />
                <span style={{ fontSize: 11, color: T.secondary, fontWeight: 600 }}>HCP {hole.index}</span>
                {isEdit && <span style={{ marginLeft: 6, fontSize: 10, color: "#93c5fd", fontWeight: 600, background: "rgba(37,99,235,0.18)", padding: "2px 8px", borderRadius: 999 }}>Edit</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Score Input Card */}
        <div className="card animate-slide-up" style={{ padding: "22px 20px" }}>

          {/* Strokes display */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <p style={{ fontSize: 10, color: T.muted, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 6 }}>Your Strokes</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <p style={{ fontSize: 88, fontWeight: 900, color: T.primary, lineHeight: 1, letterSpacing: "-3px", fontVariantNumeric: "tabular-nums" }}>{strokes}</p>
              <div style={{
                padding: "6px 12px", borderRadius: 999, fontWeight: 700, fontSize: 13,
                background: curDiff < 0 ? "rgba(34,197,94,0.18)" : curDiff > 0 ? "rgba(220,38,38,0.18)" : "rgba(255,255,255,0.1)",
                border: `1px solid ${curDiff < 0 ? "rgba(34,197,94,0.45)" : curDiff > 0 ? "rgba(220,38,38,0.45)" : "rgba(255,255,255,0.18)"}`,
                color: curDiff < 0 ? T.green : curDiff > 0 ? T.red : T.secondary,
              }}>
                {curDiff === 0 ? "Par" : curDiff > 0 ? `+${curDiff}` : curDiff}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <button onClick={() => setStrokes((v) => Math.max(1, v - 1))} disabled={strokes <= 1}
              style={{ width: 54, height: 54, borderRadius: 14, background: strokes > 1 ? "#dc2626" : "rgba(255,255,255,0.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: strokes > 1 ? "pointer" : "not-allowed", flexShrink: 0, boxShadow: strokes > 1 ? "0 4px 14px rgba(220,38,38,0.5)" : "none", transition: "all 0.15s" }}>
              <Icon icon="ph:minus-bold" style={{ fontSize: 22, color: strokes > 1 ? "#fff" : T.muted }} />
            </button>
            <input type="range" min={1} max={15} value={strokes} onChange={(e) => setStrokes(parseInt(e.target.value))} style={{ flex: 1, accentColor: "#dc2626" }} />
            <button onClick={() => setStrokes((v) => Math.min(15, v + 1))} disabled={strokes >= 15}
              style={{ width: 54, height: 54, borderRadius: 14, background: strokes < 15 ? "#16a34a" : "rgba(255,255,255,0.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: strokes < 15 ? "pointer" : "not-allowed", flexShrink: 0, boxShadow: strokes < 15 ? "0 4px 14px rgba(34,100,50,0.5)" : "none", transition: "all 0.15s" }}>
              <Icon icon="ph:plus-bold" style={{ fontSize: 22, color: strokes < 15 ? "#fff" : T.muted }} />
            </button>
          </div>

          {/* Quick buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 22 }}>
            {quick.map((q) => {
              const val    = Math.max(1, hole.par + q.offset);
              const active = strokes === val;
              return (
                <button key={q.label} onClick={() => setStrokes(val)} style={{
                  padding: "10px 4px", borderRadius: 10, border: active ? "2px solid rgba(255,255,255,0.8)" : "2px solid transparent",
                  background: q.bg, color: q.color, fontWeight: 700, fontSize: 10, cursor: "pointer",
                  boxShadow: active ? "0 0 16px rgba(255,255,255,0.25)" : "0 2px 8px rgba(0,0,0,0.4)",
                  transform: active ? "scale(1.07)" : "scale(1)", transition: "all 0.12s",
                }}>
                  {q.label}
                </button>
              );
            })}
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={saving || strokes <= 0} style={{
            width: "100%", padding: "15px 0", borderRadius: 12, border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            background: saving || strokes <= 0 ? "rgba(255,255,255,0.06)" : isEdit ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "linear-gradient(135deg,#c9a227,#e8c84a)",
            color: saving || strokes <= 0 ? T.muted : isEdit ? "#fff" : "#0e0800",
            fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: saving || strokes <= 0 ? "none" : isEdit ? "0 4px 18px rgba(37,99,235,0.45)" : "0 4px 22px rgba(201,162,39,0.45)",
            transition: "all 0.2s", marginBottom: 10,
          }}>
            {saving
              ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: "rgba(255,255,255,0.1)", borderTopColor: "#fff" }} />{isEdit ? "Updating..." : "Saving..."}</>
              : <><Icon icon={isEdit ? "ph:pencil-bold" : "ph:check-bold"} style={{ fontSize: 18 }} />{isEdit ? "Update Score" : "Submit Score"}</>
            }
          </button>

          {isEdit && existing && (
            <button onClick={() => setShowDel(true)} disabled={saving} style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: "1px solid rgba(185,28,28,0.45)", background: "rgba(185,28,28,0.14)", color: "#fca5a5", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon icon="ph:trash-bold" style={{ fontSize: 15 }} /> Delete Score
            </button>
          )}
        </div>
      </div>

      {/* Delete dialog */}
      {showDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div className="card animate-scale-in" style={{ maxWidth: 320, width: "100%", padding: "28px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(185,28,28,0.2)", border: "1px solid rgba(185,28,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <Icon icon="ph:trash-bold" style={{ fontSize: 24, color: T.red }} />
              </div>
              <h3 style={{ color: T.primary, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Delete Score?</h3>
              <p style={{ color: T.secondary, fontSize: 13 }}>Hole {hole.holeNumber} — {existing?.strokes} strokes</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDel(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.08)", color: T.primary, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: deleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: deleting ? 0.6 : 1 }}>
                {deleting ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)", borderTopColor: "#fff" }} /> : <><Icon icon="ph:trash-bold" style={{ fontSize: 14 }} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
