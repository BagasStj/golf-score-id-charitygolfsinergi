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

const quick = [
  { label: "Eagle",  bg: "#fbbf24", color: "#000", offset: -2 },
  { label: "Birdie", bg: "#22c55e", color: "#000", offset: -1 },
  { label: "Par",    bg: "#ffffff", color: "#000", offset:  0 },
  { label: "Bogey",  bg: "#DE1A58", color: "#fff", offset:  1 },
  { label: "Double", bg: "#CF0F0F", color: "#fff", offset:  2 },
];

export default function ScoringHolePage() {
  const params  = useParams();
  const router  = useRouter();
  const tournamentId = params.tournamentId as string;
  const holeNum = parseInt(params.hole as string, 10);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [strokes, setStrokes]   = useState(4);
  const [saving,  setSaving]    = useState(false);
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
  const participant  = useQuery(api.participants.getParticipantById,
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

  const hole = holes.find((h) => h.holeNumber === holeNum);
  const scores: Score[] = useMemo(() => (playerScores ?? []) as Score[], [playerScores]);
  const scoreMap = useMemo(() => new Map(scores.map((s) => [s.holeNumber, s])), [scores]);
  const existing = hole ? scoreMap.get(hole.holeNumber) : undefined;
  const isEdit   = !!existing;

  const isFinished = participant?.scoringFinished === true
    || (typeof window !== "undefined" && localStorage.getItem(`tournamentFinished_${tournamentId}_${playerId}`) === "true");

  const holesPlayed   = scores.length;
  const totalHoles    = holes.length;
  const totalStrokes  = scores.reduce((s, sc) => s + sc.strokes, 0);
  const totalPar      = scores.reduce((s, sc) => { const h = holes.find((h) => h.holeNumber === sc.holeNumber); return s + (h?.par ?? 0); }, 0);
  const runningToPar  = totalStrokes - totalPar;
  const progress      = totalHoles > 0 ? (holesPlayed / totalHoles) * 100 : 0;

  useEffect(() => {
    if (hole) setStrokes(existing?.strokes ?? hole.par);
  }, [hole, existing]);

  const flash = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2000);
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
      setTimeout(() => router.push(`/scoring/${tournamentId}`), 600);
    } catch { flash("Failed to save score", false); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!existing || !playerId) return;
    setDeleting(true);
    try {
      await deleteScore({ scoreId: existing._id, playerId: playerId as Id<"tournament_participants"> });
      flash("Score deleted", true);
      setTimeout(() => router.push(`/scoring/${tournamentId}`), 600);
    } catch { flash("Failed to delete", false); }
    finally { setDeleting(false); setShowDel(false); }
  };

  /* ── Loading ── */
  if (!hole) {
    return (
      <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  /* ── Locked (finished) ── */
  if (isFinished) {
    return (
      <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 300, width: "100%" }}>
          <Icon icon="ph:lock-bold" style={{ fontSize: 56, color: "#c9a227", marginBottom: 16 }} />
          <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 21, marginBottom: 8 }}>Round Complete</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>Scoring has been finalized.</p>
          <button onClick={() => router.push(`/scoring/${tournamentId}`)} className="btn-gold">
            Back to Scorecard
          </button>
        </div>
      </div>
    );
  }

  const curDiff = strokes - hole.par;
  const curQ    = quick.find((q) => q.offset === curDiff) ?? (curDiff <= -2 ? quick[0] : quick[4]);

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, paddingBottom: 32 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "9px 20px", borderRadius: 999, fontWeight: 600, fontSize: 12, color: "#fff", background: toast.ok ? "rgba(21,128,61,0.95)" : "rgba(185,28,28,0.95)", backdropFilter: "blur(8px)", whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.4)", animation: "fadeIn 0.2s ease-out" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(4,18,10,0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <button onClick={() => router.push(`/scoring/${tournamentId}`)} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <Icon icon="ph:arrow-left-bold" style={{ fontSize: 18, color: "rgba(255,255,255,0.8)" }} />
            </button>

            <div style={{ flex: 1 }}>
              <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", backgroundImage: "linear-gradient(to right,#c9a227,#e8c84a)", width: `${progress}%`, transition: "width 0.5s" }} />
              </div>
              <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>{holesPlayed}/{totalHoles} holes</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Total</p>
                <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1, color: runningToPar < 0 ? "#4ade80" : runningToPar > 0 ? "#f87171" : "rgba(255,255,255,0.6)" }}>
                  {runningToPar > 0 ? `+${runningToPar}` : runningToPar === 0 ? "E" : runningToPar}
                </p>
              </div>
              <Image src="/logo.png" alt="Logo" width={26} height={26} style={{ objectFit: "contain", opacity: 0.75 }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── Hole Info Card ── */}
        <div className="card animate-fade-in" style={{ padding: "22px 24px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle,rgba(201,162,39,0.1),transparent 70%)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative" }}>
            <div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 0 }}>Hole</p>
              <p style={{ fontSize: 78, fontWeight: 900, color: "#fff", lineHeight: 0.9, letterSpacing: "-3px" }}>{hole.holeNumber}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, paddingBottom: 6 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 4 }}>Par</p>
                <div style={{ width: 50, height: 50, borderRadius: 12, background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(220,38,38,0.5)" }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: "#fff" }}>{hole.par}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Icon icon="ph:flag-bold" style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>HCP {hole.index}</span>
                {isEdit && <span style={{ marginLeft: 6, fontSize: 10, color: "#60a5fa", fontWeight: 600, background: "rgba(37,99,235,0.15)", padding: "2px 8px", borderRadius: 999 }}>Edit Mode</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Score Input Card ── */}
        <div className="card animate-slide-up" style={{ padding: "22px 20px" }}>

          {/* Strokes display */}
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 6 }}>Your Strokes</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <div style={{ fontSize: 88, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-3px", fontVariantNumeric: "tabular-nums" }}>{strokes}</div>
              <div style={{
                padding: "6px 12px", borderRadius: 999, fontWeight: 700, fontSize: 13,
                background: curDiff < 0 ? "rgba(34,197,94,0.2)" : curDiff > 0 ? "rgba(220,38,38,0.2)" : "rgba(255,255,255,0.1)",
                border: `1px solid ${curDiff < 0 ? "rgba(34,197,94,0.4)" : curDiff > 0 ? "rgba(220,38,38,0.4)" : "rgba(255,255,255,0.2)"}`,
                color: curDiff < 0 ? "#4ade80" : curDiff > 0 ? "#f87171" : "rgba(255,255,255,0.6)",
              }}>
                {curDiff === 0 ? "Par" : curDiff > 0 ? `+${curDiff}` : curDiff}
              </div>
            </div>
          </div>

          {/* +/- Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <button
              onClick={() => setStrokes((v) => Math.max(1, v - 1))}
              disabled={strokes <= 1}
              style={{ width: 54, height: 54, borderRadius: 14, background: strokes > 1 ? "#dc2626" : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: strokes > 1 ? "pointer" : "not-allowed", flexShrink: 0, boxShadow: strokes > 1 ? "0 4px 14px rgba(220,38,38,0.45)" : "none", transition: "all 0.15s" }}
            >
              <Icon icon="ph:minus-bold" style={{ fontSize: 22, color: strokes > 1 ? "#fff" : "rgba(255,255,255,0.2)" }} />
            </button>
            <input
              type="range" min={1} max={15} value={strokes}
              onChange={(e) => setStrokes(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: "#dc2626" }}
            />
            <button
              onClick={() => setStrokes((v) => Math.min(15, v + 1))}
              disabled={strokes >= 15}
              style={{ width: 54, height: 54, borderRadius: 14, background: strokes < 15 ? "#16a34a" : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: strokes < 15 ? "pointer" : "not-allowed", flexShrink: 0, boxShadow: strokes < 15 ? "0 4px 14px rgba(34,100,50,0.45)" : "none", transition: "all 0.15s" }}
            >
              <Icon icon="ph:plus-bold" style={{ fontSize: 22, color: strokes < 15 ? "#fff" : "rgba(255,255,255,0.2)" }} />
            </button>
          </div>

          {/* Quick score buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 22 }}>
            {quick.map((q) => {
              const val = Math.max(1, hole.par + q.offset);
              const active = strokes === val;
              return (
                <button
                  key={q.label}
                  onClick={() => setStrokes(val)}
                  style={{
                    padding: "10px 4px", borderRadius: 10, border: active ? "2px solid #fff" : "2px solid transparent",
                    background: q.bg, color: q.color, fontWeight: 700, fontSize: 10,
                    cursor: "pointer", transition: "transform 0.1s, box-shadow 0.1s",
                    boxShadow: active ? `0 0 14px rgba(255,255,255,0.3)` : "0 2px 6px rgba(0,0,0,0.3)",
                    transform: active ? "scale(1.07)" : "scale(1)",
                  }}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || strokes <= 0}
            style={{
              width: "100%", padding: "15px 0", borderRadius: 12, border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              backgroundImage: saving || strokes <= 0 ? "none" : isEdit ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "linear-gradient(135deg,#c9a227,#e8c84a)",
              background: saving || strokes <= 0 ? "rgba(255,255,255,0.06)" : undefined,
              color: saving || strokes <= 0 ? "rgba(255,255,255,0.2)" : isEdit ? "#fff" : "#0e0800",
              fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: saving || strokes <= 0 ? "none" : isEdit ? "0 4px 16px rgba(37,99,235,0.4)" : "0 4px 20px rgba(201,162,39,0.4)",
              transition: "all 0.2s", marginBottom: 10,
            }}
          >
            {saving
              ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: "rgba(255,255,255,0.1)", borderTopColor: "#fff" }} />{isEdit ? "Updating..." : "Saving..."}</>
              : <><Icon icon={isEdit ? "ph:pencil-bold" : "ph:check-bold"} style={{ fontSize: 18 }} />{isEdit ? "Update Score" : "Submit Score"}</>
            }
          </button>

          {/* Delete */}
          {isEdit && existing && (
            <button
              onClick={() => setShowDel(true)}
              disabled={saving}
              style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: "1px solid rgba(185,28,28,0.4)", background: "rgba(185,28,28,0.12)", color: "#fca5a5", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}
            >
              <Icon icon="ph:trash-bold" style={{ fontSize: 15 }} /> Delete Score
            </button>
          )}
        </div>
      </div>

      {/* ── Delete dialog ── */}
      {showDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div className="card animate-scale-in" style={{ maxWidth: 320, width: "100%", padding: "28px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(185,28,28,0.2)", border: "1px solid rgba(185,28,28,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <Icon icon="ph:trash-bold" style={{ fontSize: 24, color: "#f87171" }} />
              </div>
              <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Delete Score?</h3>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Hole {hole.holeNumber} — {existing?.strokes} strokes</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDel(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: deleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: deleting ? 0.6 : 1 }}>
                {deleting ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} /> : <><Icon icon="ph:trash-bold" style={{ fontSize: 14 }} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
