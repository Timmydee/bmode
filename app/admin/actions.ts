"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  adminToken,
  safeEqual,
} from "@/lib/admin-auth";

export async function signIn(formData: FormData) {
  const password = process.env.ADMIN_PASSWORD;
  const attempt = formData.get("password");
  const token = adminToken();
  if (!password || !token || typeof attempt !== "string" || !safeEqual(attempt, password)) {
    redirect("/admin?error=1");
  }
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  redirect("/admin");
}

export async function signOut() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin");
}
