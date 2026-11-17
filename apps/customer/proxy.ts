import type { NextRequest } from "next/server";
import { handleRequest } from "@iron40/core/supabase/proxy";

const PUBLIC = [/^\/$/, /^\/login$/, /^\/signup$/, /^\/install$/, /^\/q\/[a-z0-9]+$/, /^\/auth\/confirm$/, /^\/cart$/];

export async function proxy(request: NextRequest) {
  return handleRequest(request, {
    app: "customer",
    isPublic: (p) => PUBLIC.some((r) => r.test(p)),
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|offline.html|manifest.webmanifest|robots.txt).*)"],
};
