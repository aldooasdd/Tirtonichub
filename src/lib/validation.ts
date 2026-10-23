import { z } from "zod";
import { ROLE_CODES } from "./roles";

function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string): boolean {
  const domains = allowedDomains();
  if (domains.length === 0) return true; // dev: tanpa pembatas
  const at = email.toLowerCase().split("@")[1];
  return !!at && domains.includes(at);
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email tidak valid")
  .refine(isAllowedEmail, "Domain email tidak diizinkan");

export const otpSchema = z.string().trim().regex(/^\d{6}$/, "Kode OTP 6 digit");

const e164 = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Nomor WA harus format +62…");

export const roleCodeSchema = z.enum(ROLE_CODES);

export const employeeSchema = z.object({
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter"),
  email: emailSchema,
  waNumber: e164,
  branchId: z.string().trim().min(1).nullable().optional(),
  joinedAt: z.coerce.date().nullable().optional(),
  scheduleId: z.string().trim().min(1).nullable().optional(),
  roleCodes: z.array(roleCodeSchema).min(1, "Minimal 1 role"),
});

export const branchSchema = z.object({
  name: z.string().trim().min(2, "Nama cabang minimal 2 karakter"),
  address: z.string().trim().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
});

export const profileSelfSchema = z.object({
  nickname: z.string().trim().max(50).optional().nullable(),
  bio: z.string().trim().max(280).optional().nullable(),
  themePref: z.enum(["light", "dark", "system"]).optional(),
});

// Pakai z.input (bentuk yang dikirim client sebelum coerce) untuk tipe argumen action.
export type EmployeeInput = z.input<typeof employeeSchema>;
export type BranchInput = z.input<typeof branchSchema>;
