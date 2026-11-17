import "server-only";
import { redirect } from "next/navigation";
import { whoami } from "@iron40/core/supabase/server";

export type Role = "owner" | "admin" | "dispatcher";

// Every ops page and action starts here. The database re-checks the role on every call regardless.
export async function requireStaff(roles?: Role[]) {
  const ctx = await whoami("ops");
  if (!ctx.user) redirect("/login");
  if (ctx.who.kind !== "staff") redirect("/");
  if (roles && !roles.includes(ctx.who.role)) redirect("/");
  return { supabase: ctx.supabase, user: ctx.user, who: ctx.who };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function ago(iso: string | null) {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
