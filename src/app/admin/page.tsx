"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Icon } from "@iconify/react";
import * as XLSX from "xlsx";

// ── Glass color palette (opaque glass, dark green tint) ───────────────────────
const C = {
  // Glass backgrounds — high opacity
  glass:       "rgba(8, 24, 14, 0.90)",      // main card
  glassDark:   "rgba(4, 14, 8, 0.95)",       // headers / deep sections
  glassAlt:    "rgba(6, 18, 10, 0.75)",      // alt rows / inner surfaces
  glassHover:  "rgba(14, 38, 22, 0.88)",     // row hover
  glassInput:  "rgba(3, 12, 6, 0.92)",       // input fields
  glassModal:  "rgba(6, 20, 12, 0.96)",      // modal cards
  // Borders
  border:       "rgba(255,255,255,0.11)",
  borderStrong: "rgba(255,255,255,0.20)",
  borderGold:   "rgba(201,162,39,0.55)",
  borderRed:    "rgba(220,38,38,0.45)",
  // Text
  text:        "rgba(255,255,255,0.95)",
  textSec:     "rgba(255,255,255,0.65)",
  textMuted:   "rgba(255,255,255,0.38)",
  // Accent
  gold:        "#e8c84a",
  goldDim:     "#c9a227",
  green:       "#4ade80",
  red:         "#f87171",
  blue:        "#38bdf8",
  orange:      "#fb923c",
};

const blur = "blur(22px) saturate(1.5)";

// ── Shared card style ─────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: C.glass,
  backdropFilter: blur,
  WebkitBackdropFilter: blur,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: "0 8px 36px rgba(0,0,0,0.55)",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Participant = {
  _id: Id<"tournament_participants">;
  name: string;
  phone?: string;
  bagTag?: string;
  handicap?: number;
  scoringFinished?: boolean;
  startHole?: number;
  tournamentId: Id<"tournaments">;
  flightId: Id<"flights">;
  token?: string;
  email?: string;
};

type Score = {
  _id: Id<"scores">;
  holeNumber: number;
  strokes: number;
  playerId: Id<"tournament_participants">;
  tournamentId: Id<"tournaments">;
};

type LeaderboardEntry = Participant & {
  scores: Score[];
  totalStrokes: number;
  scoreToPar: number;
  holesPlayed: number;
};

type HoleConfig = { holeNumber: number; par: number; index: number };

// ── Score color helpers ───────────────────────────────────────────────────────

function scoreText(s: number, par: number) {
  const d = s - par;
  if (d <= -2) return C.blue;
  if (d === -1) return C.green;
  if (d === 0)  return C.textSec;
  if (d === 1)  return C.orange;
  return C.red;
}
function scoreBg(s: number, par: number) {
  const d = s - par;
  if (d <= -2) return "rgba(56,189,248,0.18)";
  if (d === -1) return "rgba(74,222,128,0.16)";
  if (d === 0)  return "rgba(255,255,255,0.06)";
  if (d === 1)  return "rgba(251,146,60,0.18)";
  return "rgba(248,113,113,0.18)";
}
function scoreBorder(s: number, par: number) {
  const d = s - par;
  if (d <= -2) return "rgba(56,189,248,0.45)";
  if (d === -1) return "rgba(74,222,128,0.40)";
  if (d === 0)  return "rgba(255,255,255,0.14)";
  if (d === 1)  return "rgba(251,146,60,0.40)";
  return "rgba(248,113,113,0.45)";
}

// ── Export Excel ──────────────────────────────────────────────────────────────

function exportScoresExcel(leaderboard: LeaderboardEntry[], holesConfig: HoleConfig[], tournamentName: string) {
  const holes = holesConfig.slice().sort((a, b) => a.holeNumber - b.holeNumber);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);

  const headers = ["Nama", "Bag Tag", "No. HP", ...holes.map((h) => `H${h.holeNumber}`), "Total", "Score to Par", "Holes Played"];
  const parRow  = ["Par",  "",        "",       ...holes.map((h) => h.par),               totalPar, "",             ""];

  const rows = leaderboard.map((p) => {
    const sm = Object.fromEntries(p.scores.map((s) => [s.holeNumber, s.strokes]));
    return [
      p.name,
      p.bagTag ?? "",
      p.phone  ?? "",
      ...holes.map((h) => sm[h.holeNumber] ?? ""),
      p.holesPlayed > 0 ? p.totalStrokes : "",
      p.holesPlayed > 0 ? (p.scoreToPar === 0 ? "E" : p.scoreToPar > 0 ? `+${p.scoreToPar}` : p.scoreToPar) : "",
      p.holesPlayed,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, parRow, ...rows]);

  // Column widths
  ws["!cols"] = [
    { wch: 24 }, // Nama
    { wch: 10 }, // Bag Tag
    { wch: 14 }, // No. HP
    ...holes.map(() => ({ wch: 5 })),
    { wch: 7  }, // Total
    { wch: 10 }, // Score to Par
    { wch: 12 }, // Holes Played
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Scores");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${tournamentName.replace(/\s+/g, "_")}_scores_${date}.xlsx`);
}

// ── Modal Overlay ─────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSave }: {
  user: Participant;
  onClose: () => void;
  onSave: (name: string, phone: string, bagTag: string) => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [bagTag, setBagTag] = useState(user.bagTag ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("Nama tidak boleh kosong"); return; }
    setSaving(true); setError("");
    try { await onSave(name.trim(), phone.trim(), bagTag.trim()); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ ...card, background: C.glassModal, width: "min(420px, 90vw)", padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon icon="ph:pencil-simple-bold" style={{ fontSize: 18, color: C.gold }} />
            <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Edit Player</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}>
            <Icon icon="ph:x-bold" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Nama", value: name, setter: setName, placeholder: "Nama player" },
            { label: "No. Handphone", value: phone, setter: setPhone, placeholder: "08xxxxxxxxxx" },
            { label: "Bag Tag", value: bagTag, setter: setBagTag, placeholder: "BT-0000" },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label}>
              <label style={{ display: "block", color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                {label}
              </label>
              <input
                style={{ width: "100%", background: C.glassInput, border: `1px solid ${C.borderStrong}`, borderRadius: 10, padding: "11px 16px", color: C.text, fontSize: 14, outline: "none", backdropFilter: blur, WebkitBackdropFilter: blur }}
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
              />
            </div>
          ))}

          {error && (
            <div style={{ background: "rgba(220,38,38,0.15)", border: `1px solid ${C.borderRed}`, borderRadius: 8, padding: "9px 12px", color: C.red, fontSize: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.textSec, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Batal
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-green" style={{ flex: 2, padding: "12px", fontSize: 13 }}>
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete User Modal ─────────────────────────────────────────────────────────

function DeleteUserModal({ user, onClose, onConfirm }: {
  user: Participant;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => { setDeleting(true); try { await onConfirm(); onClose(); } finally { setDeleting(false); } };

  return (
    <Modal onClose={onClose}>
      <div style={{ ...card, background: C.glassModal, width: "min(380px, 90vw)", padding: "28px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>
          <Icon icon="ph:warning-circle-bold" style={{ color: C.red }} />
        </div>
        <h3 style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Hapus Player?</h3>
        <p style={{ color: C.textSec, fontSize: 13, marginBottom: 6 }}>
          <strong style={{ color: C.text }}>{user.name}</strong> akan dihapus beserta semua scorenya.
        </p>
        <p style={{ color: C.red, fontSize: 12, marginBottom: 22 }}>Tindakan ini tidak dapat dibatalkan.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.textSec, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Batal
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: "12px", background: "rgba(220,38,38,0.75)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}>
            {deleting ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Score Edit Modal (+ delete score) ────────────────────────────────────────

function ScoreEditModal({ playerName, holeNumber, par, currentStrokes, scoreId, onClose, onSave, onDelete }: {
  playerName: string;
  holeNumber: number;
  par: number;
  currentStrokes: number | null;
  scoreId: Id<"scores"> | null;
  onClose: () => void;
  onSave: (strokes: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [strokes, setStrokes] = useState(currentStrokes ?? par);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const diff = strokes - par;
  const label = diff === 0 ? "Par" : diff === -1 ? "Birdie" : diff <= -2 ? "Eagle" : diff === 1 ? "Bogey" : diff === 2 ? "Double Bogey" : `+${diff}`;

  const handleSave = async () => {
    if (strokes < 1) return;
    setSaving(true);
    try { await onSave(strokes); onClose(); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(); onClose(); } finally { setDeleting(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ ...card, background: C.glassModal, width: "min(340px, 90vw)", padding: "26px 22px" }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <p style={{ color: C.gold, fontWeight: 700, fontSize: 13 }}>Hole {holeNumber} · Par {par}</p>
            <p style={{ color: C.textSec, fontSize: 12, marginTop: 2 }}>{playerName}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}>
            <Icon icon="ph:x-bold" style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Score display */}
        <div style={{ textAlign: "center", marginBottom: 20, padding: "16px 12px", background: "rgba(0,0,0,0.30)", border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: strokes > 0 ? scoreText(strokes, par) : C.textMuted, lineHeight: 1 }}>
            {strokes}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: strokes > 0 ? scoreText(strokes, par) : C.textMuted }}>
            {strokes === 0 ? "—" : label}
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 18 }}>
          <button onClick={() => setStrokes((s) => Math.max(1, s - 1))} style={{ width: 46, height: 46, borderRadius: "50%", border: `1px solid ${C.borderStrong}`, background: "rgba(255,255,255,0.07)", color: C.text, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon icon="ph:minus-bold" />
          </button>
          <input
            type="number" min={1} max={20} value={strokes}
            onChange={(e) => setStrokes(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: 68, textAlign: "center", background: C.glassInput, border: `1px solid ${C.borderStrong}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 24, padding: "8px 0", backdropFilter: blur }}
          />
          <button onClick={() => setStrokes((s) => Math.min(20, s + 1))} style={{ width: 46, height: 46, borderRadius: "50%", border: `1px solid ${C.borderStrong}`, background: "rgba(255,255,255,0.07)", color: C.text, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon icon="ph:plus-bold" />
          </button>
        </div>

        {/* Quick buttons */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, justifyContent: "center" }}>
          {[par - 2, par - 1, par, par + 1, par + 2].filter((v) => v >= 1).map((v) => (
            <button
              key={v} onClick={() => setStrokes(v)}
              style={{ padding: "7px 11px", borderRadius: 8, border: `1px solid ${strokes === v ? C.goldDim : C.border}`, background: strokes === v ? "rgba(201,162,39,0.18)" : "rgba(255,255,255,0.06)", color: strokes === v ? C.gold : C.textSec, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Save / Cancel */}
        <div style={{ display: "flex", gap: 8, marginBottom: currentStrokes !== null ? 10 : 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.textSec, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Batal
          </button>
          <button onClick={handleSave} disabled={saving || strokes < 1} className="btn-green" style={{ flex: 2, padding: "11px", fontSize: 13 }}>
            {saving ? "Menyimpan..." : currentStrokes === null ? "Input Score" : "Update Score"}
          </button>
        </div>

        {/* Delete score — only if score exists */}
        {currentStrokes !== null && scoreId !== null && (
          <>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ width: "100%", padding: "9px", background: "rgba(220,38,38,0.10)", border: `1px solid ${C.borderRed}`, borderRadius: 10, color: C.red, fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Icon icon="ph:trash-bold" style={{ fontSize: 14 }} />
                Hapus Score Hole {holeNumber}
              </button>
            ) : (
              <div style={{ background: "rgba(220,38,38,0.12)", border: `1px solid ${C.borderRed}`, borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ color: C.red, fontSize: 12, fontWeight: 600, marginBottom: 10, textAlign: "center" }}>
                  Yakin hapus score hole {holeNumber}?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Batal
                  </button>
                  <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: "8px", background: "rgba(220,38,38,0.75)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}>
                    {deleting ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ── User Management ───────────────────────────────────────────────────────────

function UserManagement({ participants, leaderboard, onEdit, onDelete }: {
  participants: Participant[];
  leaderboard: LeaderboardEntry[];
  onEdit: (u: Participant) => void;
  onDelete: (u: Participant) => void;
}) {
  const [search, setSearch] = useState("");

  const holesMap  = Object.fromEntries(leaderboard.map((e) => [e._id, e.holesPlayed]));
  const spMap     = Object.fromEntries(leaderboard.map((e) => [e._id, e.scoreToPar]));
  const strokeMap = Object.fromEntries(leaderboard.map((e) => [e._id, e.totalStrokes]));

  const filtered = participants.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.bagTag ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q);
  });

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 16, position: "relative" }}>
        <Icon icon="ph:magnifying-glass-bold" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.textMuted, pointerEvents: "none" }} />
        <input
          style={{ width: "100%", background: C.glassInput, backdropFilter: blur, WebkitBackdropFilter: blur, border: `1px solid ${C.borderStrong}`, borderRadius: 10, padding: "11px 16px 11px 42px", color: C.text, fontSize: 13, outline: "none" }}
          placeholder="Cari nama, bag tag, atau nomor HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { icon: "ph:users-bold",           label: "Total Player",    value: participants.length, color: C.gold },
          { icon: "ph:golf-bold",            label: "Sedang Bermain", value: participants.filter((p) => !p.scoringFinished && (holesMap[p._id] ?? 0) > 0).length, color: C.green },
          { icon: "ph:flag-checkered-bold",  label: "Selesai",        value: participants.filter((p) => p.scoringFinished).length, color: C.blue },
        ].map(({ icon, label, value, color }) => (
          <div key={label} style={{ ...card, padding: "16px 12px", textAlign: "center" }}>
            <Icon icon={icon} style={{ fontSize: 22, color, marginBottom: 6 }} />
            <div style={{ color: C.text, fontWeight: 800, fontSize: 22 }}>{value}</div>
            <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div style={{ ...card, overflow: "hidden", padding: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, background: C.glassDark, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon icon="ph:users-three-bold" style={{ fontSize: 15, color: C.gold }} />
          <span style={{ color: C.gold, fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Daftar Player ({filtered.length})
          </span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Icon icon="ph:users-bold" style={{ fontSize: 36, color: C.textMuted, display: "block", margin: "0 auto 12px" }} />
            <p style={{ color: C.textSec, fontSize: 13 }}>{search ? "Tidak ada hasil pencarian" : "Belum ada player terdaftar"}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            {/* Column labels */}
            <div style={{ display: "grid", gridTemplateColumns: "32px minmax(140px,2fr) 90px 130px 60px 70px 70px 90px", padding: "8px 16px", background: C.glassAlt, borderBottom: `1px solid ${C.border}`, minWidth: 760 }}>
              {["#", "Nama", "Bag Tag", "No. HP", "Holes", "Strokes", "Score", "Aksi"].map((h, i) => (
                <div key={h} style={{ color: C.textMuted, fontSize: 10, fontWeight: 700, textAlign: i > 3 ? "center" : "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {h}
                </div>
              ))}
            </div>

            {filtered.map((p, i) => {
              const holes   = holesMap[p._id]  ?? 0;
              const sp      = spMap[p._id]     ?? 0;
              const strokes = strokeMap[p._id] ?? 0;
              return (
                <div
                  key={p._id}
                  style={{ display: "grid", gridTemplateColumns: "32px minmax(140px,2fr) 90px 130px 60px 70px 70px 90px", padding: "12px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center", minWidth: 760, background: i % 2 === 1 ? "rgba(0,0,0,0.18)" : "transparent", transition: "background 0.12s", cursor: "default" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.glassHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 1 ? "rgba(0,0,0,0.18)" : "transparent")}
                >
                  <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600 }}>{i + 1}</div>
                  <div>
                    <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                    {p.scoringFinished && <span style={{ fontSize: 10, color: C.blue, fontWeight: 600 }}>Selesai</span>}
                  </div>
                  <div style={{ color: C.textSec, fontSize: 12 }}>{p.bagTag ?? "—"}</div>
                  <div style={{ color: C.textSec, fontSize: 12 }}>{p.phone ?? "—"}</div>
                  <div style={{ textAlign: "center", color: C.textSec, fontSize: 12 }}>{holes}/18</div>
                  <div style={{ textAlign: "center", color: C.text, fontWeight: 600, fontSize: 13 }}>{holes > 0 ? strokes : "—"}</div>
                  <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14, color: holes === 0 ? C.textMuted : sp < 0 ? C.green : sp > 0 ? C.red : C.textSec }}>
                    {holes === 0 ? "—" : sp === 0 ? "E" : sp > 0 ? `+${sp}` : sp}
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                    <button onClick={() => onEdit(p)} style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${C.borderGold}`, background: "rgba(201,162,39,0.12)", color: C.gold, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon icon="ph:pencil-simple-bold" style={{ fontSize: 12 }} />
                      Edit
                    </button>
                    <button onClick={() => onDelete(p)} style={{ padding: "5px 8px", borderRadius: 7, border: `1px solid ${C.borderRed}`, background: "rgba(220,38,38,0.12)", color: C.red, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Icon icon="ph:trash-bold" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Live Scoring ──────────────────────────────────────────────────────────────

function LiveScoring({ leaderboard, holesConfig, tournamentName, onEditScore }: {
  leaderboard: LeaderboardEntry[];
  holesConfig: HoleConfig[];
  tournamentId: Id<"tournaments">;
  tournamentName: string;
  onEditScore: (player: LeaderboardEntry, hole: HoleConfig, currentStrokes: number | null, scoreId: Id<"scores"> | null) => void;
}) {
  const [search, setSearch] = useState("");
  const holes = holesConfig.slice().sort((a, b) => a.holeNumber - b.holeNumber);
  const filtered = leaderboard.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.bagTag ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const totalPar = holes.reduce((s, h) => s + h.par, 0);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
          <Icon icon="ph:magnifying-glass-bold" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.textMuted, pointerEvents: "none" }} />
          <input
            style={{ width: "100%", background: C.glassInput, backdropFilter: blur, WebkitBackdropFilter: blur, border: `1px solid ${C.borderStrong}`, borderRadius: 10, padding: "10px 16px 10px 42px", color: C.text, fontSize: 13, outline: "none" }}
            placeholder="Cari nama atau bag tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Export Excel button */}
        <button
          onClick={() => exportScoresExcel(leaderboard, holesConfig, tournamentName)}
          style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid rgba(74,222,128,0.40)`, background: "rgba(74,222,128,0.10)", color: C.green, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}
        >
          <Icon icon="ph:download-simple-bold" style={{ fontSize: 16 }} />
          Export Excel
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "Eagle",   color: C.blue,    bg: scoreBg(1, 3) },
          { label: "Birdie",  color: C.green,   bg: scoreBg(2, 3) },
          { label: "Par",     color: C.textSec, bg: scoreBg(3, 3) },
          { label: "Bogey",   color: C.orange,  bg: scoreBg(4, 3) },
          { label: "Double+", color: C.red,     bg: scoreBg(5, 3) },
        ].map(({ label, color, bg }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: bg, border: `1px solid ${color}60`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, color, fontWeight: 800 }}>●</span>
            </div>
            <span style={{ fontSize: 10, color: C.textSec }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <Icon icon="ph:hand-tap-bold" style={{ fontSize: 13, color: C.textMuted }} />
          <span style={{ fontSize: 10, color: C.textMuted }}>Klik cell untuk edit / hapus</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: "hidden", padding: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, background: C.glassDark, display: "flex", alignItems: "center", gap: 8 }}>
          <div className="live-dot" />
          <span style={{ color: C.gold, fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Live Scoring — {filtered.length} Player
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: Math.max(700, 200 + holes.length * 50) }}>
            <thead>
              {/* Hole number row */}
              <tr style={{ background: C.glassAlt }}>
                <th style={{ padding: "9px 14px", textAlign: "left", color: C.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", position: "sticky", left: 0, background: C.glassAlt, backdropFilter: blur, WebkitBackdropFilter: blur, zIndex: 2, whiteSpace: "nowrap", minWidth: 170, borderRight: `1px solid ${C.border}` }}>
                  Player
                </th>
                {holes.map((h) => (
                  <th key={h.holeNumber} style={{ padding: "9px 4px", textAlign: "center", color: C.textMuted, fontSize: 11, fontWeight: 700, minWidth: 46 }}>
                    {h.holeNumber}
                  </th>
                ))}
                <th style={{ padding: "9px 10px", textAlign: "center", color: C.textMuted, fontSize: 10, fontWeight: 700, minWidth: 58, textTransform: "uppercase" }}>Total</th>
                <th style={{ padding: "9px 10px", textAlign: "center", color: C.textMuted, fontSize: 10, fontWeight: 700, minWidth: 58, textTransform: "uppercase" }}>Over</th>
              </tr>
              {/* Par row */}
              <tr style={{ background: "rgba(0,0,0,0.30)", borderBottom: `1px solid ${C.borderStrong}` }}>
                <td style={{ padding: "5px 14px", color: C.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", position: "sticky", left: 0, background: "rgba(0,0,0,0.50)", backdropFilter: blur, WebkitBackdropFilter: blur, zIndex: 2, borderRight: `1px solid ${C.border}` }}>
                  Par
                </td>
                {holes.map((h) => (
                  <td key={h.holeNumber} style={{ padding: "5px 4px", textAlign: "center", color: C.textSec, fontSize: 11, fontWeight: 600 }}>
                    {h.par}
                  </td>
                ))}
                <td style={{ padding: "5px 10px", textAlign: "center", color: C.textSec, fontSize: 11, fontWeight: 700 }}>
                  {totalPar}
                </td>
                <td />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={holes.length + 3} style={{ padding: 40, textAlign: "center", color: C.textSec, fontSize: 13 }}>
                    Belum ada data scoring
                  </td>
                </tr>
              ) : (
                filtered.map((player, rowIdx) => {
                  const scoreMap = Object.fromEntries(player.scores.map((s) => [s.holeNumber, s]));
                  const stickyBg = rowIdx % 2 === 0 ? "rgba(8,24,14,0.92)" : "rgba(4,14,8,0.95)";
                  return (
                    <tr key={player._id} style={{ borderBottom: `1px solid ${C.border}`, background: rowIdx % 2 === 1 ? "rgba(0,0,0,0.14)" : "transparent" }}>
                      {/* Sticky name */}
                      <td style={{ padding: "9px 14px", position: "sticky", left: 0, background: stickyBg, backdropFilter: blur, WebkitBackdropFilter: blur, zIndex: 1, whiteSpace: "nowrap", borderRight: `1px solid ${C.border}` }}>
                        <div style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>{player.name}</div>
                        <div style={{ color: C.textMuted, fontSize: 10, marginTop: 1 }}>
                          {player.bagTag ? `${player.bagTag} · ` : ""}{player.holesPlayed > 0 ? `${player.holesPlayed}/18 holes` : "Belum mulai"}
                        </div>
                      </td>

                      {/* Score cells */}
                      {holes.map((hole) => {
                        const score = scoreMap[hole.holeNumber];
                        const strokes = score?.strokes ?? null;
                        const sid = score?._id ?? null;
                        return (
                          <td key={hole.holeNumber} style={{ padding: "4px 4px", textAlign: "center" }}>
                            <button
                              onClick={() => onEditScore(player, hole, strokes, sid)}
                              title={`Hole ${hole.holeNumber}${strokes !== null ? ` · ${strokes} strokes` : " · Belum diisi"}`}
                              style={{
                                width: 38, height: 38, borderRadius: 8,
                                border: `1px solid ${strokes !== null ? scoreBorder(strokes, hole.par) : C.border}`,
                                background: strokes !== null ? scoreBg(strokes, hole.par) : "rgba(255,255,255,0.03)",
                                color: strokes !== null ? scoreText(strokes, hole.par) : C.textMuted,
                                fontWeight: strokes !== null ? 800 : 400,
                                fontSize: 13, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}
                            >
                              {strokes !== null ? strokes : <Icon icon="ph:plus-bold" style={{ fontSize: 10 }} />}
                            </button>
                          </td>
                        );
                      })}

                      {/* Total */}
                      <td style={{ padding: "9px 10px", textAlign: "center" }}>
                        <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>
                          {player.holesPlayed > 0 ? player.totalStrokes : "—"}
                        </span>
                      </td>
                      {/* Score to par */}
                      <td style={{ padding: "9px 10px", textAlign: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: player.holesPlayed === 0 ? C.textMuted : player.scoreToPar < 0 ? C.green : player.scoreToPar > 0 ? C.red : C.textSec }}>
                          {player.holesPlayed === 0 ? "—" : player.scoreToPar === 0 ? "E" : player.scoreToPar > 0 ? `+${player.scoreToPar}` : player.scoreToPar}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [tab, setTab] = useState<"users" | "scoring">("users");

  const [editingUser,  setEditingUser]  = useState<Participant | null>(null);
  const [deletingUser, setDeletingUser] = useState<Participant | null>(null);
  const [editingScore, setEditingScore] = useState<{
    player: LeaderboardEntry;
    hole: HoleConfig;
    currentStrokes: number | null;
    scoreId: Id<"scores"> | null;
  } | null>(null);

  useEffect(() => {
    const auth = sessionStorage.getItem("adminAuth");
    if (auth === "true") { setAuthed(true); }
    else { router.replace("/admin/login"); }
    setCheckingAuth(false);
  }, [router]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("adminAuth");
    router.push("/admin/login");
  }, [router]);

  const tournament  = useQuery(api.tournaments.getActiveTournament);
  const participants = useQuery(api.participants.listParticipants, authed && tournament ? { tournamentId: tournament._id } : "skip") as Participant[] | undefined;
  const leaderboard  = useQuery(api.scores.getTournamentLeaderboard, authed && tournament ? { tournamentId: tournament._id } : "skip") as LeaderboardEntry[] | undefined;

  const updateParticipant = useMutation(api.participants.updateParticipant);
  const deleteParticipant = useMutation(api.participants.deleteParticipant);
  const submitScore       = useMutation(api.scores.submitScore);
  const deleteScore       = useMutation(api.scores.deleteScore);

  const handleSaveUser = useCallback(async (name: string, phone: string, bagTag: string) => {
    if (!editingUser) return;
    await updateParticipant({ participantId: editingUser._id, name, phone, bagTag });
  }, [editingUser, updateParticipant]);

  const handleDeleteUser = useCallback(async () => {
    if (!deletingUser) return;
    await deleteParticipant({ participantId: deletingUser._id });
  }, [deletingUser, deleteParticipant]);

  const handleSaveScore = useCallback(async (strokes: number) => {
    if (!editingScore || !tournament) return;
    await submitScore({ tournamentId: tournament._id, playerId: editingScore.player._id, holeNumber: editingScore.hole.holeNumber, strokes });
  }, [editingScore, tournament, submitScore]);

  const handleDeleteScore = useCallback(async () => {
    if (!editingScore?.scoreId) return;
    await deleteScore({ scoreId: editingScore.scoreId, playerId: editingScore.player._id });
  }, [editingScore, deleteScore]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }
  if (!authed) return null;

  const holesConfig = (tournament?.holesConfig ?? []) as HoleConfig[];
  const isLoading = tournament === undefined || participants === undefined || leaderboard === undefined;

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(5,15,8,0.94)", backdropFilter: blur, WebkitBackdropFilter: blur, borderBottom: `1px solid ${C.borderStrong}`, boxShadow: "0 2px 16px rgba(0,0,0,0.5)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "11px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/logo.png" alt="Logo" width={32} height={32} style={{ objectFit: "contain" }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: C.gold, fontWeight: 800, fontSize: 14 }}>Admin Panel</div>
            <div style={{ color: C.textMuted, fontSize: 11 }}>{tournament ? tournament.name : "Memuat..."}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {tournament && (
              <span style={{ fontSize: 10, color: C.textSec, display: "flex", alignItems: "center", gap: 4 }}>
                <div className="live-dot" style={{ width: 6, height: 6 }} />
                Live
              </span>
            )}
            <button
              onClick={handleLogout}
              style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.06)", color: C.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >
              <Icon icon="ph:sign-out-bold" style={{ fontSize: 14 }} />
              Keluar
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {([
            { key: "users",   icon: "ph:users-three-bold", label: "User Management" },
            { key: "scoring", icon: "ph:golf-bold",        label: "Live Scoring" },
          ] as const).map(({ key, icon, label }) => (
            <button
              key={key} onClick={() => setTab(key)}
              style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${tab === key ? C.borderGold : C.border}`, background: tab === key ? "rgba(201,162,39,0.14)" : "rgba(255,255,255,0.05)", color: tab === key ? C.gold : C.textSec, fontWeight: tab === key ? 700 : 500, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, backdropFilter: blur, WebkitBackdropFilter: blur }}
            >
              <Icon icon={icon} style={{ fontSize: 16 }} />
              {label}
            </button>
          ))}
        </div>

        {/* No tournament */}
        {!isLoading && !tournament && (
          <div style={{ ...card, padding: 48, textAlign: "center" }}>
            <Icon icon="ph:calendar-x-bold" style={{ fontSize: 40, color: C.textMuted, display: "block", margin: "0 auto 12px" }} />
            <p style={{ color: C.textSec, fontSize: 14 }}>Tidak ada turnamen aktif saat ini.</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
            <div className="spinner" />
          </div>
        )}

        {/* Content */}
        {!isLoading && tournament && participants && leaderboard && (
          <>
            {tab === "users" && (
              <UserManagement participants={participants} leaderboard={leaderboard} onEdit={setEditingUser} onDelete={setDeletingUser} />
            )}
            {tab === "scoring" && (
              <LiveScoring
                leaderboard={leaderboard}
                holesConfig={holesConfig}
                tournamentId={tournament._id}
                tournamentName={tournament.name}
                onEditScore={(player, hole, strokes, sid) => setEditingScore({ player, hole, currentStrokes: strokes, scoreId: sid })}
              />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {editingUser  && <EditUserModal  user={editingUser}  onClose={() => setEditingUser(null)}  onSave={handleSaveUser} />}
      {deletingUser && <DeleteUserModal user={deletingUser} onClose={() => setDeletingUser(null)} onConfirm={handleDeleteUser} />}
      {editingScore && (
        <ScoreEditModal
          playerName={editingScore.player.name}
          holeNumber={editingScore.hole.holeNumber}
          par={editingScore.hole.par}
          currentStrokes={editingScore.currentStrokes}
          scoreId={editingScore.scoreId}
          onClose={() => setEditingScore(null)}
          onSave={handleSaveScore}
          onDelete={handleDeleteScore}
        />
      )}
    </div>
  );
}
