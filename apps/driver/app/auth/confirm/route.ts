import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@iron40/core/supabase/server";
import { safeNext } from "@iron40/core/supabase/proxy";

// Email confirmation landing. Handles both the PKCE code flow and token-hash links.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"), "/");
  const supabase = await createClient("driver");

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  const dest = url.clone();
  dest.search = "";
  dest.pathname = ok ? next : "/login";
  return NextResponse.redirect(dest);
}
