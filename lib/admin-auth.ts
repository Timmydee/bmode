import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// One shared password (ADMIN_PASSWORD) guards /admin. The cookie holds an
// HMAC of the password rather than the password itself, so changing the
// password signs every browser out.
export const ADMIN_COOKIE = "bmode_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function adminToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password).update("bmode-admin-v1").digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function isAdmin(): Promise<boolean> {
  const token = adminToken();
  if (!token) return false;
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  return cookie !== undefined && safeEqual(cookie, token);
}
