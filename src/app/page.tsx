"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if player has a session token
    const token = localStorage.getItem("playerToken");
    const tournamentId = localStorage.getItem("tournamentId");

    if (token && tournamentId) {
      router.replace(`/scoring/${tournamentId}`);
    } else {
      router.replace("/register");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-golf flex items-center justify-center">
      <div className="relative z-10 text-center">
        <div className="w-12 h-12 border-2 border-t-transparent border-yellow-500 rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}
