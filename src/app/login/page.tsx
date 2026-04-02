"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeTournament = useQuery(api.tournaments.getActiveTournament);
  const loginPlayer = useMutation(api.participants.loginPlayer);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Full name is required"); return; }
    if (!phone.trim()) { setError("Phone number is required"); return; }

    setLoading(true);
    setError("");
    try {
      const tournament = activeTournament;
      if (!tournament) {
        setError("No active tournament found.");
        setLoading(false);
        return;
      }

      const result = await loginPlayer({
        tournamentId: tournament._id as Id<"tournaments">,
        name: name.trim(),
        phone: phone.trim(),
      });

      localStorage.setItem("playerToken", result.token ?? "");
      localStorage.setItem("playerId", result.participantId);
      localStorage.setItem("tournamentId", tournament._id);
      localStorage.setItem("playerName", name.trim());

      router.push(`/scoring/${tournament._id}`);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Login failed. Please try again.";
      let cleanMsg = "Terjadi kesalahan sistem. Silakan coba lagi nanti.";
      if (rawMsg.includes("ConvexError:")) {
        cleanMsg = rawMsg.split("ConvexError:")[1].split("\\n")[0].split(" at ")[0].trim();
      } else if (!rawMsg.includes("[CONVEX") && !rawMsg.includes("Server Error")) {
        cleanMsg = rawMsg.replace("Uncaught Error: ", "").split(" at ")[0].trim();
      }
      setError(cleanMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      position: "relative",
      zIndex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
    }}>

      {/* ── Logo + Club Name ── */}
      <div className="animate-fade-in" style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
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
          fontSize: 24,
          fontWeight: 700,
          color: "#c9a227",
          letterSpacing: "0.06em",
          textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          marginBottom: 4,
          textTransform: "uppercase",
        }}>
          Imperial Klub Golf
        </h1>
        <p style={{
          fontSize: 11,
          letterSpacing: "0.45em",
          fontWeight: 600,
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
        }}>
          Lippo Village
        </p>
      </div>

      {/* ── Login Card ── */}
      <div
        className="card animate-slide-up"
        style={{
          width: "100%",
          maxWidth: 380,
          padding: "28px 24px 32px",
        }}
      >
        {/* Event logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Image
            src="/logo-2.png"
            alt="Charity Golf Sinergi"
            width={0}
            height={0}
            sizes="100vw"
            style={{ width: "auto", height: 64, objectFit: "contain" }}
          />
        </div>

        <h2 style={{
          textAlign: "center",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.28em",
          color: "#fff",
          textTransform: "uppercase",
          marginBottom: 22,
        }}>
          Player Login
        </h2>

        {/* Form fields */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            id="login-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoComplete="name"
            className="field"
          />
          <input
            id="login-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            autoComplete="tel"
            className="field"
          />

          {error && (
            <p style={{
              color: "#fca5a5",
              fontSize: 12,
              textAlign: "center",
              background: "rgba(185,28,28,0.15)",
              border: "1px solid rgba(185,28,28,0.3)",
              borderRadius: 10,
              padding: "8px 14px",
              lineHeight: 1.5,
            }}>
              {error}
            </p>
          )}
        </form>
      </div>

      {/* ── Login Button ── */}
      <div className="animate-fade-in" style={{ width: "100%", maxWidth: 380, marginTop: 20 }}>
        <button
          id="btn-login"
          onClick={handleSubmit}
          disabled={loading}
          className="btn-gold"
        >
          {loading
            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
              Logging in...
            </span>
            : "Login"
          }
        </button>

        <p style={{ textAlign: "center", marginTop: 16, color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
          Not registered yet?{" "}
          <button
            onClick={() => router.push("/register")}
            style={{ color: "#c9a227", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 12 }}
          >
            Go to Registration
          </button>
        </p>
      </div>

      {/* ── Branding Footer ── */}
      <div style={{ marginTop: 40, textAlign: "center", opacity: 0.7 }}>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          Powered by <span style={{ color: "#c9a227", fontWeight: 800, fontSize: 12 }}>GolfScore.id</span>
        </p>
      </div>
    </div>
  );
}
