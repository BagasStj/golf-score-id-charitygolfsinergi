"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { Resend } from "resend";

export const sendScorecardEmail = action({
  args: {
    recipientEmail: v.string(),
    recipientName: v.string(),
    tournamentName: v.string(),
    courseName: v.string(),
    tournamentDate: v.string(),
    flightName: v.string(),
    scores: v.array(
      v.object({
        holeNumber: v.number(),
        par: v.number(),
        strokes: v.number(),
      })
    ),
    totalStrokes: v.number(),
    totalPar: v.number(),
  },
  handler: async (
    _ctx,
    {
      recipientEmail,
      recipientName,
      tournamentName,
      courseName,
      tournamentDate,
      flightName,
      scores,
      totalStrokes,
      totalPar,
    }
  ) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const resend = new Resend(resendKey);
    const scoreToPar = totalStrokes - totalPar;
    const scoreLabel =
      scoreToPar === 0 ? "E" : scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;

    const getScoreColor = (strokes: number, par: number) => {
      const diff = strokes - par;
      if (diff <= -2) return "#f59e0b"; // eagle
      if (diff === -1) return "#22c55e"; // birdie
      if (diff === 0) return "#6b7280"; // par
      if (diff === 1) return "#de1a58"; // bogey
      return "#cf0f0f"; // double+
    };

    const getScoreLabel = (strokes: number, par: number) => {
      const diff = strokes - par;
      if (diff <= -2) return "Eagle";
      if (diff === -1) return "Birdie";
      if (diff === 0) return "Par";
      if (diff === 1) return "Bogey";
      return `+${diff}`;
    };

    const scoreRows = scores
      .sort((a, b) => a.holeNumber - b.holeNumber)
      .map(
        ({ holeNumber, par, strokes }) => `
        <tr style="border-bottom: 1px solid #374151;">
          <td style="padding: 8px 12px; font-weight: bold; color: #fff;">Hole ${holeNumber}</td>
          <td style="padding: 8px 12px; text-align: center; color: #9ca3af;">Par ${par}</td>
          <td style="padding: 8px 12px; text-align: center;">
            <span style="
              display: inline-block;
              width: 32px; height: 32px;
              border-radius: 50%;
              background: ${getScoreColor(strokes, par)};
              color: ${strokes - par <= -2 || strokes - par === 0 ? "#000" : strokes - par === -1 ? "#000" : "#fff"};
              line-height: 32px;
              font-weight: bold;
              font-size: 14px;
            ">${strokes}</span>
          </td>
          <td style="padding: 8px 12px; text-align: center; color: ${getScoreColor(strokes, par)}; font-weight: bold;">
            ${getScoreLabel(strokes, par)}
          </td>
        </tr>
      `
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Scorecard - ${recipientName}</title>
</head>
<body style="margin: 0; padding: 0; background: #0d1117; font-family: 'Segoe UI', Arial, sans-serif; color: #fff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    
    <!-- Header -->
    <div style="text-align: center; padding: 32px 0 24px; border-bottom: 2px solid #374151;">
      <h1 style="margin: 0; font-size: 28px; color: #c9a227; letter-spacing: 2px;">IMPERIAL KLUB GOLF</h1>
      <p style="margin: 4px 0 0; color: #9ca3af; font-size: 13px; letter-spacing: 3px;">LIPPO VILLAGE</p>
    </div>

    <!-- Tournament Info -->
    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <h2 style="margin: 0 0 12px; font-size: 20px; color: #fff;">${tournamentName}</h2>
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        <span style="color: #9ca3af; font-size: 13px;">📅 ${tournamentDate}</span>
        <span style="color: #9ca3af; font-size: 13px;">⛳ ${courseName}</span>
        <span style="color: #9ca3af; font-size: 13px;">✈️ ${flightName}</span>
      </div>
    </div>

    <!-- Player Score Summary -->
    <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center; border: 1px solid #c9a227;">
      <p style="margin: 0 0 4px; color: #9ca3af; font-size: 12px; letter-spacing: 2px;">PEMAIN</p>
      <h3 style="margin: 0 0 16px; font-size: 22px; color: #c9a227;">${recipientName}</h3>
      <div style="display: flex; justify-content: center; gap: 32px;">
        <div>
          <p style="margin: 0; font-size: 40px; font-weight: 900; color: #fff;">${totalStrokes}</p>
          <p style="margin: 4px 0 0; color: #9ca3af; font-size: 12px;">TOTAL STROKES</p>
        </div>
        <div>
          <p style="margin: 0; font-size: 40px; font-weight: 900; color: ${scoreToPar < 0 ? "#22c55e" : scoreToPar > 0 ? "#ef4444" : "#9ca3af"};">${scoreLabel}</p>
          <p style="margin: 4px 0 0; color: #9ca3af; font-size: 12px;">OVER/UNDER PAR</p>
        </div>
        <div>
          <p style="margin: 0; font-size: 40px; font-weight: 900; color: #fff;">${scores.length}</p>
          <p style="margin: 4px 0 0; color: #9ca3af; font-size: 12px;">HOLES PLAYED</p>
        </div>
      </div>
    </div>

    <!-- Scorecard Table -->
    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
      <div style="background: #c9a227; padding: 12px 20px;">
        <h3 style="margin: 0; color: #000; font-size: 14px; letter-spacing: 2px;">SCORECARD DETAIL</h3>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #0d1117;">
            <th style="padding: 10px 12px; text-align: left; color: #9ca3af; font-size: 12px; letter-spacing: 1px;">HOLE</th>
            <th style="padding: 10px 12px; text-align: center; color: #9ca3af; font-size: 12px; letter-spacing: 1px;">PAR</th>
            <th style="padding: 10px 12px; text-align: center; color: #9ca3af; font-size: 12px; letter-spacing: 1px;">STROKES</th>
            <th style="padding: 10px 12px; text-align: center; color: #9ca3af; font-size: 12px; letter-spacing: 1px;">RESULT</th>
          </tr>
        </thead>
        <tbody>
          ${scoreRows}
          <tr style="background: #1f2937; font-weight: bold;">
            <td style="padding: 12px; color: #c9a227; font-size: 14px;">TOTAL</td>
            <td style="padding: 12px; text-align: center; color: #9ca3af;">${totalPar}</td>
            <td style="padding: 12px; text-align: center; color: #fff; font-size: 18px;">${totalStrokes}</td>
            <td style="padding: 12px; text-align: center; color: ${scoreToPar < 0 ? "#22c55e" : scoreToPar > 0 ? "#ef4444" : "#9ca3af"}; font-size: 18px;">${scoreLabel}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px; color: #4b5563; font-size: 12px; border-top: 1px solid #374151;">
      <p style="margin: 0;">Email ini dikirim otomatis dari sistem scoring golf.</p>
      <p style="margin: 4px 0 0; color: #c9a227;">Imperial Klub Golf · Lippo Village</p>
    </div>
  </div>
</body>
</html>`;

    const fromEmail = process.env.EMAIL_FROM || "noreply@resend.dev";
    
    const { error } = await resend.emails.send({
      from: `Imperial Golf Scoring <${fromEmail}>`,
      to: recipientEmail,
      subject: `Scorecard ${recipientName} — ${tournamentName}`,
      html,
    });

    if (error) throw new Error(error.message);
    return { success: true };
  },
});
