// Kirim OTP: app → webhook n8n → node WAHA. Fallback email bila WA gagal.
// ⚠️ Workflow OTP di n8n WAJIB mematikan penyimpanan eksekusi (biar kode tak bocor di log).

export type OtpChannel = "wa" | "email" | "dev-console";

async function sendViaN8n(waNumber: string, code: string, ttlMin: number): Promise<boolean> {
  const url = process.env.N8N_OTP_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": process.env.N8N_OTP_WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify({ waNumber, code, ttlMinutes: ttlMin }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendViaEmail(email: string, code: string, ttlMin: number): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  if (!host) return false;
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? "no-reply@tirtonichub.com",
      to: email,
      subject: "Kode OTP Tirtonic",
      text: `Kode OTP kamu: ${code}. Berlaku ${ttlMin} menit. Jangan bagikan kode ini.`,
    });
    return true;
  } catch {
    return false;
  }
}

/** Kirim OTP via WA (n8n), fallback email. Dev tanpa keduanya: log ke console. */
export async function sendOtp(
  waNumber: string,
  email: string,
  code: string,
  ttlMin = Number(process.env.OTP_TTL_MINUTES) || 5,
): Promise<OtpChannel> {
  if (await sendViaN8n(waNumber, code, ttlMin)) return "wa";
  if (await sendViaEmail(email, code, ttlMin)) return "email";
  if (process.env.NODE_ENV !== "production") {
    // ponytail: dev aid saat n8n/SMTP belum diset — JANGAN pernah di produksi.
    console.log(`[DEV OTP] ${email} / ${waNumber} → ${code}`);
    return "dev-console";
  }
  throw new Error("OTP gagal terkirim (WA & email)");
}
