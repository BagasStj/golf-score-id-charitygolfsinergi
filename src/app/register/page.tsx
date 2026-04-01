"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bagTag, setBagTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeTournament = useQuery(api.tournaments.getActiveTournament);
  const registerPlayer = useMutation(api.participants.registerPlayer);
  const seedTournament = useMutation(api.tournaments.seedTournament);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Full name is required"); return; }
    if (!bagTag.trim()) { setError("Bag tag number is required"); return; }

    setLoading(true);
    setError("");
    try {
      let tournament = activeTournament;
      if (!tournament) {
        await seedTournament();
        setError("Setting up tournament, please try again in a moment.");
        setLoading(false);
        return;
      }

      const result = await registerPlayer({
        tournamentId: tournament._id as Id<"tournaments">,
        name: name.trim(),
        phone: phone.trim() || undefined,
        bagTag: bagTag.trim(),
      });

      localStorage.setItem("playerToken", result.token);
      localStorage.setItem("playerId", result.participantId);
      localStorage.setItem("tournamentId", tournament._id);
      localStorage.setItem("playerName", name.trim());

      router.push(`/scoring/${tournament._id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Background inherited from body via globals.css */
    <div style={{ minHeight: "100dvh", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>

      {/* ── Logo + Club Name ── */}
      <div className="animate-fade-in" style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Image
            src="/logo.png"
            alt="Imperial Klub Golf"
            width={100}
            height={100}
            style={{ objectFit: "contain", filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))" }}
            priority
          />
        </div>
        <h1 style={{
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontSize: 30, fontWeight: 700,
          color: "#c9a227",
          letterSpacing: "0.04em",
          textShadow: "0 2px 12px rgba(0,0,0,0.4)",
          marginBottom: 6,
        }}>
          Imperial Klub Golf
        </h1>
        <p style={{
          fontSize: 11, letterSpacing: "0.45em", fontWeight: 600,
          color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
        }}>
          Lippo Village
        </p>
      </div>

      {/* ── Registration Card ── */}
      <div className="card animate-slide-up" style={{ width: "100%", maxWidth: 380, padding: "32px 28px" }}>

        {/* Event logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <Image
            src="/logo-2.png"
            alt="Charity Golf Sinergi"
            width={0}
            height={0}
            sizes="100vw"
            style={{ width: "auto", height: 70, objectFit: "contain" }}
          />
        </div>

        <h2 style={{
          textAlign: "center", fontWeight: 700, fontSize: 14,
          letterSpacing: "0.22em", color: "#fff", textTransform: "uppercase",
          marginBottom: 24,
        }}>
          Player Registration
        </h2>

        {/* Form fields */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            id="reg-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoComplete="name"
            className="field"
          />
          <input
            id="reg-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            autoComplete="tel"
            className="field"
          />
          <input
            id="reg-bagtag"
            type="text"
            value={bagTag}
            onChange={(e) => setBagTag(e.target.value)}
            placeholder="Bag tag number"
            className="field"
          />

          {error && (
            <p style={{ color: "#fca5a5", fontSize: 12, textAlign: "center", background: "rgba(185,28,28,0.15)", border: "1px solid rgba(185,28,28,0.3)", borderRadius: 10, padding: "8px 14px", lineHeight: 1.5 }}>
              {error}
            </p>
          )}
        </form>
      </div>

      {/* ── Register Button ── (outside card, below) */}
      <div className="animate-fade-in" style={{ width: "100%", maxWidth: 380, marginTop: 20 }}>
        <button
          id="btn-register"
          onClick={handleSubmit}
          disabled={loading}
          className="btn-gold"
        >
          {loading
            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                Registering...
              </span>
            : "Register"
          }
        </button>

        <p style={{ textAlign: "center", marginTop: 16, color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
          Already registered?{" "}
          <button
            onClick={() => {
              const tid = localStorage.getItem("tournamentId");
              if (tid) router.push(`/scoring/${tid}`);
              else setError("No session found. Please register.");
            }}
            style={{ color: "#c9a227", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 12 }}
          >
            Continue to Scoring
          </button>
        </p>
      </div>
    </div>
  );
}
