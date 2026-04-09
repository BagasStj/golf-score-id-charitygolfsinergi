"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@iconify/react";

const blur = "blur(22px) saturate(1.5)";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 400));
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
    if (password === adminPassword) {
      sessionStorage.setItem("adminAuth", "true");
      router.push("/admin");
    } else {
      setError("Password salah. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/logo.png" alt="Logo" width={64} height={64} style={{ objectFit: "contain", margin: "0 auto 16px" }} />
          <h1 style={{ color: "#e8c84a", fontWeight: 800, fontSize: 22, letterSpacing: "0.04em", marginBottom: 4 }}>
            Admin Panel
          </h1>
          <p style={{ color: "rgba(255,255,255,0.40)", fontSize: 13 }}>Imperial Klub Golf</p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "rgba(8, 24, 14, 0.90)",
            backdropFilter: blur,
            WebkitBackdropFilter: blur,
            border: "1px solid rgba(255,255,255,0.13)",
            borderRadius: 18,
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            padding: "32px 28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
            <Icon icon="ph:lock-key-bold" style={{ fontSize: 18, color: "#e8c84a" }} />
            <span style={{ color: "rgba(255,255,255,0.90)", fontWeight: 700, fontSize: 14 }}>
              Masuk sebagai Admin
            </span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                style={{ display: "block", color: "rgba(255,255,255,0.40)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}
              >
                Password Admin
              </label>
              <input
                type="password"
                style={{
                  width: "100%",
                  background: "rgba(3,12,6,0.92)",
                  backdropFilter: blur,
                  WebkitBackdropFilter: blur,
                  border: "1px solid rgba(255,255,255,0.20)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: "rgba(255,255,255,0.95)",
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "inherit",
                }}
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(220,38,38,0.15)",
                  border: "1px solid rgba(220,38,38,0.45)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  color: "#f87171",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon icon="ph:warning-circle-bold" style={{ fontSize: 16, flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-gold"
              disabled={loading || !password}
              style={{ marginTop: 4 }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#1a0a00", borderRadius: "50%", animation: "spin 0.85s linear infinite", display: "inline-block" }} />
                  Memverifikasi...
                </span>
              ) : "Masuk"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.22)", fontSize: 11, marginTop: 20 }}>
          Akses terbatas untuk administrator
        </p>
      </div>
    </div>
  );
}
