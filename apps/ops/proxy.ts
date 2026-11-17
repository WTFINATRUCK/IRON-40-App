import type { NextRequest } from "next/server";
import { handleRequest } from "@iron40/core/supabase/proxy";

const PUBLIC = [/^\/login$/, /^\/join$/, /^\/auth\/confirm$/];

export async function proxy(request: NextRequest) {
  return handleRequest(request, {
    app: "ops",
    isPublic: (p) => PUBLIC.some((r) => r.test(p)),
    // signed, short-lived ID photo URLs come from Supabase Storage
    imgHosts: [process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""].filter(Boolean),
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|offline.html|manifest.webmanifest|robots.txt).*)"],
};
