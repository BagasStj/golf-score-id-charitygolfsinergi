"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Icon } from "@iconify/react";
import Image from "next/image";

type Participant = {
  _id: Id<"tournament_participants">;
  name: string;
  scoringFinished?: boolean;
};
type Score = { _id: Id<"scores">; holeNumber: number; strokes: number; submittedAt?: number };
type HoleConfig = { holeNumber: number; par: number; index: number };

const T = {
  primary:   "rgba(255,255,255,0.96)",
  secondary: "rgba(255,255,255,0.75)",
  muted:     "rgba(255,255,255,0.55)",
  dim:       "rgba(255,255,255,0.38)",
  gold:      "#c9a227",
  green:     "#4ade80",
  red:       "#f87171",
};

function scoreBg(strokes: number, par: number) {
  const d = strokes - par;
  if (d <= -2) return { bg: "#fbbf24", color: "#000" };
  if (d === -1) return { bg: "#22c55e", color: "#000" };
  if (d === 0)  return { bg: "#fff",    color: "#000" };
  if (d === 1)  return { bg: "#DE1A58", color: "#fff" };
  return              { bg: "#CF0F0F", color: "#fff" };
}

/* ── Email Modal ── */
function EmailModal({ tournamentId, playerId, holes, scores, tournament, onClose, onSent }: {
  tournamentId: string; playerId: string; holes: HoleConfig[]; scores: Score[];
  tournament: { name: string; courseName: string; date: string };
  onClose: () => void; onSent: () => void;
}) {
  const [email, setEmail]   = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr]       = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendEmail   = useMutation(api.email.sendScorecardEmail as any);
  const updateEmail = useMutation(api.participants.updateParticipantEmail);
  const name = typeof window !== "undefined" ? (localStorage.getItem("playerName") ?? "") : "";
  const tot  = scores.reduce((s, sc) => s + sc.strokes, 0);
  const par  = scores.reduce((s, sc) => { const h = holes.find((h) => h.holeNumber === sc.holeNumber); return s + (h?.par ?? 0); }, 0);

  const handleSend = async () => {
    if (!email.includes("@")) { setErr("Enter a valid email address"); return; }
    setSending(true); setErr("");
    try {
      await updateEmail({ participantId: playerId as Id<"tournament_participants">, email });
      await sendEmail({ recipientEmail: email, recipientName: name, tournamentName: tournament.name, courseName: tournament.courseName, tournamentDate: tournament.date, flightName: "Flight", scores: scores.map((s) => ({ holeNumber: s.holeNumber, par: holes.find((h) => h.holeNumber === s.holeNumber)?.par ?? 4, strokes: s.strokes })), totalStrokes: tot, totalPar: par });
      onSent();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to send email"); }
    finally { setSending(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div className="card animate-scale-in" style={{ maxWidth: 360, width: "100%", padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Icon icon="ph:envelope-bold" style={{ color: T.gold, fontSize: 22 }} />
          <h3 style={{ color: T.primary, fontWeight: 700, fontSize: 17 }}>Send Scorecard via Email</h3>
        </div>
        <p style={{ color: T.secondary, fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>Enter your email to receive your scorecard.</p>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" autoFocus className="field" style={{ borderRadius: 12, marginBottom: 12 }} />
        {err && <p style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{err}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: T.primary, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSend} disabled={sending} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", backgroundImage: "linear-gradient(135deg,#c9a227,#e8c84a)", color: "#0e0800", fontWeight: 700, fontSize: 13, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {sending ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: "rgba(0,0,0,0.2)", borderTopColor: "#000" }} /> : <><Icon icon="ph:paper-plane-bold" /> Send</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Scorecard (individual) ── */
function Scorecard({ holes, scores, onHoleClick, scoringFinished }: {
  holes: HoleConfig[]; scores: Score[];
  onHoleClick: (h: number) => void; scoringFinished: boolean;
}) {
  const [mode, setMode] = useState<"stroke" | "over">("stroke");
  const sm            = new Map(scores.map((s) => [s.holeNumber, s]));
  const totalPar      = holes.reduce((s, h) => s + h.par, 0);
  const totalStrokes  = scores.reduce((s, sc) => s + sc.strokes, 0);
  const playedPar     = scores.reduce((s, sc) => { const h = holes.find((h) => h.holeNumber === sc.holeNumber); return s + (h?.par ?? 0); }, 0);
  const scoreToPar    = totalStrokes - playedPar;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Mode toggle */}
      <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: T.secondary, fontSize: 13, fontWeight: 600 }}>View mode</span>
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.35)", borderRadius: 10, padding: 3 }}>
          {(["stroke","over"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11, backgroundImage: mode === m ? "linear-gradient(135deg,#c9a227,#e8c84a)" : "none", background: mode === m ? undefined : "transparent", color: mode === m ? "#0e0800" : T.muted, transition: "all 0.2s" }}>
              {m === "stroke" ? "Stroke" : "+/-"}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="card" style={{ padding: "8px 14px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 16px" }}>
          {[["#fbbf24","Eagle"],["#22c55e","Birdie"],["#fff","Par"],["#DE1A58","Bogey"],["#CF0F0F","Double+"]].map(([c,l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: c, border: c === "#fff" ? "1px solid rgba(0,0,0,0.15)" : "none" }} />
              <span style={{ color: T.secondary, fontSize: 10, fontWeight: 600 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.09)" }}>
                <td style={{ padding: "7px 12px", color: T.secondary, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.08)" }}>Hole</td>
                {holes.map((h) => (
                  <td key={h.holeNumber}
                    style={{ textAlign: "center", padding: "7px 4px", fontWeight: 700, color: T.primary, minWidth: 32, cursor: scoringFinished ? "default" : "pointer" }}
                    onClick={() => !scoringFinished && onHoleClick(h.holeNumber)}
                  >
                    {h.holeNumber}
                  </td>
                ))}
                <td style={{ textAlign: "center", padding: "7px 10px", fontWeight: 700, color: T.gold, borderLeft: "2px solid rgba(201,162,39,0.45)" }}>Tot</td>
              </tr>
              <tr style={{ background: "rgba(0,0,0,0.25)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <td style={{ padding: "5px 12px", color: T.muted, fontWeight: 600, fontSize: 10, borderRight: "1px solid rgba(255,255,255,0.08)" }}>Par</td>
                {holes.map((h) => <td key={h.holeNumber} style={{ textAlign: "center", padding: "5px 4px", color: T.muted, fontWeight: 600 }}>{h.par}</td>)}
                <td style={{ textAlign: "center", padding: "5px 10px", color: T.secondary, fontWeight: 700, borderLeft: "2px solid rgba(201,162,39,0.45)" }}>{totalPar}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "10px 12px", color: T.secondary, fontWeight: 700, fontSize: 11, borderRight: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>Score</td>
                {holes.map((h) => {
                  const sc    = sm.get(h.holeNumber);
                  const style = sc ? scoreBg(sc.strokes, h.par) : null;
                  const val   = sc ? (mode === "over"
                    ? (sc.strokes - h.par === 0 ? "E" : sc.strokes - h.par > 0 ? `+${sc.strokes - h.par}` : `${sc.strokes - h.par}`)
                    : String(sc.strokes)) : null;
                  return (
                    <td key={h.holeNumber} style={{ textAlign: "center", padding: "8px 3px", cursor: scoringFinished ? "default" : "pointer" }}
                      onClick={() => !scoringFinished && onHoleClick(h.holeNumber)}
                    >
                      {sc && style
                        ? <div style={{ width: 26, height: 26, borderRadius: "50%", background: style.bg, color: style.color, fontWeight: 700, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>{val}</div>
                        : <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                            <Icon icon="ph:minus" style={{ color: T.muted, fontSize: 12 }} />
                          </div>
                      }
                    </td>
                  );
                })}
                <td style={{ textAlign: "center", padding: "8px 10px", borderLeft: "2px solid rgba(201,162,39,0.45)" }}>
                  <div style={{ color: T.primary, fontWeight: 800, fontSize: 15 }}>{totalStrokes || "—"}</div>
                  {totalStrokes > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: scoreToPar < 0 ? T.green : scoreToPar > 0 ? T.red : T.muted }}>
                      {scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar === 0 ? "E" : scoreToPar}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function ScoringPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.tournamentId as string;

  const [tab,        setTab]        = useState<"scorecard"|"leaderboard">("scorecard");
  const [playerId,   setPlayerId]   = useState<string|null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailSent,  setEmailSent]  = useState(false);
  const [finishOk,   setFinishOk]   = useState(false);
  const [finished,   setFinished]   = useState(false);

  useEffect(() => {
    const id  = localStorage.getItem("playerId");
    const tid = localStorage.getItem("tournamentId");
    if (!id || tid !== tournamentId) { router.replace("/register"); return; }
    setPlayerId(id);
  }, [tournamentId, router]);

  const tournament  = useQuery(api.tournaments.getTournamentById, { tournamentId: tournamentId as Id<"tournaments"> });
  const participant = useQuery(api.participants.getParticipantById,
    playerId ? { participantId: playerId as Id<"tournament_participants"> } : "skip"
  ) as Participant | null | undefined;
  const playerScores = useQuery(api.scores.getPlayerScores,
    playerId ? { tournamentId: tournamentId as Id<"tournaments">, playerId: playerId as Id<"tournament_participants"> } : "skip"
  );
  const leaderboard   = useQuery(api.scores.getTournamentLeaderboard, { tournamentId: tournamentId as Id<"tournaments"> });
  const finishScoring = useMutation(api.flights.finishScoring);

  const holes: HoleConfig[] = useMemo(() => {
    if (!tournament?.holesConfig) return [];
    const seen = new Set<number>();
    return tournament.holesConfig
      .filter((h: HoleConfig) => { if (seen.has(h.holeNumber)) return false; seen.add(h.holeNumber); return true; })
      .sort((a: HoleConfig, b: HoleConfig) => a.holeNumber - b.holeNumber);
  }, [tournament?.holesConfig]);

  const scores: Score[] = useMemo(() => (playerScores ?? []) as Score[], [playerScores]);
  const holesPlayed  = scores.length;
  const totalHoles   = holes.length;
  const allDone      = totalHoles > 0 && holesPlayed === totalHoles;
  const progress     = totalHoles > 0 ? (holesPlayed / totalHoles) * 100 : 0;
  const totalStrokes = scores.reduce((s, sc) => s + sc.strokes, 0);
  const playedPar    = scores.reduce((s, sc) => { const h = holes.find((h) => h.holeNumber === sc.holeNumber); return s + (h?.par ?? 0); }, 0);
  const scoreToPar   = totalStrokes - playedPar;

  useEffect(() => {
    if (!participant) return;
    setFinished(participant.scoringFinished === true
      || localStorage.getItem(`tournamentFinished_${tournamentId}_${playerId}`) === "true");
  }, [participant, tournamentId, playerId]);

  const handleFinish = async () => {
    if (!playerId) return;
    await finishScoring({ playerId: playerId as Id<"tournament_participants"> });
    localStorage.setItem(`tournamentFinished_${tournamentId}_${playerId}`, "true");
    setFinished(true); setFinishOk(true);
  };

  const handleHoleClick = (h: number) => router.push(`/scoring/${tournamentId}/score/${h}`);

  const handleInputNext = () => {
    const done   = new Set(scores.map((s) => s.holeNumber));
    const sorted = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
    const next   = sorted.find((h) => !done.has(h.holeNumber)) ?? sorted[0];
    if (next) router.push(`/scoring/${tournamentId}/score/${next.holeNumber}`);
  };

  if (!tournament) return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>

      {/* ── Header ── */}
      <div className="header-surface" style={{ position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={() => router.push("/register")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: T.secondary, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              <Icon icon="ph:sign-out-bold" style={{ fontSize: 14 }} /> Exit
            </button>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: T.gold, fontWeight: 700, fontSize: 13, letterSpacing: "0.04em" }}>{tournament.name}</p>
              <p style={{ color: T.muted, fontSize: 10, marginTop: 1 }}>{tournament.courseName}</p>
            </div>
            <Image src="/logo.png" alt="Logo" width={28} height={28} style={{ objectFit: "contain" }} />
          </div>

          {/* Progress */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", backgroundImage: "linear-gradient(to right,#c9a227,#e8c84a)", width: `${progress}%`, borderRadius: 2, transition: "width 0.5s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: T.secondary }}>{holesPlayed}/{totalHoles} holes</span>
              {totalStrokes > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: scoreToPar < 0 ? T.green : scoreToPar > 0 ? T.red : T.secondary }}>
                  {scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar === 0 ? "E (Par)" : scoreToPar}
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.35)", borderRadius: 12, padding: 4, border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["scorecard","leaderboard"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, transition: "all 0.2s", backgroundImage: tab === t ? "linear-gradient(135deg,#c9a227,#e8c84a)" : "none", background: tab === t ? undefined : "transparent", color: tab === t ? "#0e0800" : T.muted }}>
                {t === "scorecard" ? "Scorecard" : "Leaderboard"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 48px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Finish banner */}
        {finished && (
          <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, borderColor: "rgba(34,197,94,0.35)" }}>
            <Icon icon="ph:check-circle-bold" style={{ fontSize: 32, color: T.green, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: T.primary, fontWeight: 700, fontSize: 14 }}>Scoring Complete!</p>
              <p style={{ color: T.green, fontSize: 12, marginTop: 2 }}>All 18 holes submitted.</p>
            </div>
            {process.env.NEXT_PUBLIC_ENABLE_EMAIL === "true" && !emailSent && (
              <button onClick={() => setEmailModal(true)} style={{ padding: "8px 14px", borderRadius: 10, backgroundImage: "linear-gradient(135deg,#c9a227,#e8c84a)", color: "#0e0800", fontWeight: 700, fontSize: 11, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                <Icon icon="ph:envelope-bold" style={{ fontSize: 13 }} /> Email
              </button>
            )}
          </div>
        )}

        {tab === "scorecard" ? (
          <>
            <Scorecard holes={holes} scores={scores} onHoleClick={handleHoleClick} scoringFinished={finished} />
            {!finished && (
              <div className="card" style={{ padding: 14 }}>
                {!allDone ? (
                  <button onClick={handleInputNext} style={{ width: "100%", padding: "15px 0", border: "none", borderRadius: 12, cursor: "pointer", backgroundImage: "linear-gradient(135deg,#c9a227,#e8c84a)", color: "#0e0800", fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 18px rgba(201,162,39,0.4)" }}>
                    <Icon icon="ph:golf-bold" style={{ fontSize: 20 }} /> Input Score
                  </button>
                ) : (
                  <button onClick={handleFinish} style={{ width: "100%", padding: "15px 0", border: "none", borderRadius: 12, cursor: "pointer", backgroundImage: "linear-gradient(135deg,#15803d,#16a34a)", color: T.primary, fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 18px rgba(34,100,50,0.4)" }}>
                    <Icon icon="ph:flag-checkered-bold" style={{ fontSize: 20 }} /> Finish Round
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.25)" }}>
              <Icon icon="ph:trophy-bold" style={{ fontSize: 16, color: T.gold }} />
              <span style={{ color: T.gold, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Leaderboard</span>
            </div>
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["#","Player","Over","Str","Holes"].map((h, i) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: i < 2 ? "left" : "center", color: T.secondary, fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(leaderboard ?? []).map((p, i) => {
                    const sp   = p.scoreToPar;
                    const isMe = p._id === playerId;
                    return (
                      <tr key={p._id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: isMe ? "rgba(201,162,39,0.09)" : undefined }}>
                        <td style={{ padding: "12px 12px" }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#92400e" : "rgba(255,255,255,0.08)", color: i < 3 ? "#000" : T.secondary, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                        </td>
                        <td style={{ padding: "12px 12px" }}>
                          <div style={{ color: isMe ? T.gold : T.primary, fontWeight: isMe ? 700 : 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                            {p.name}{isMe && <span style={{ fontSize: 10, color: T.gold, marginLeft: 4 }}>(You)</span>}
                          </div>
                          {p.bagTag && <div style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>Bag: {p.bagTag}</div>}
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 10px", fontWeight: 800, fontSize: 16, color: sp < 0 ? T.green : sp > 0 ? T.red : T.secondary }}>
                          {p.holesPlayed === 0 ? "—" : sp === 0 ? "E" : sp > 0 ? `+${sp}` : sp}
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 10px", color: p.holesPlayed === 0 ? T.muted : T.secondary, fontWeight: 600 }}>
                          {p.holesPlayed === 0 ? "—" : p.totalStrokes}
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 10px" }}>
                          <div style={{ color: T.secondary, fontSize: 11 }}>{p.holesPlayed}/{holes.length}</div>
                          <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginTop: 3, maxWidth: 36, margin: "3px auto 0" }}>
                            <div style={{ height: "100%", borderRadius: 2, backgroundImage: "linear-gradient(to right,#c9a227,#e8c84a)", width: `${holes.length > 0 ? (p.holesPlayed / holes.length) * 100 : 0}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(leaderboard ?? []).length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: T.muted }}>No scores yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Finish success */}
      {finishOk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div className="card animate-scale-in" style={{ maxWidth: 320, width: "100%", padding: 32, textAlign: "center" }}>
            <Icon icon="ph:check-circle-bold" style={{ fontSize: 60, color: T.green, marginBottom: 16 }} />
            <h3 style={{ color: T.primary, fontWeight: 700, fontSize: 21, marginBottom: 8 }}>Round Complete!</h3>
            <p style={{ color: T.secondary, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>Your scorecard has been saved successfully.</p>
            <button onClick={() => setFinishOk(false)} className="btn-green" style={{ width: "100%", padding: "13px 0", fontSize: 14 }}>View Scorecard</button>
          </div>
        </div>
      )}

      {emailModal && tournament && (
        <EmailModal tournamentId={tournamentId} playerId={playerId ?? ""} holes={holes} scores={scores}
          tournament={tournament as { name: string; courseName: string; date: string }}
          onClose={() => setEmailModal(false)} onSent={() => { setEmailSent(true); setEmailModal(false); }} />
      )}
    </div>
  );
}
