import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "../csp";
import { env, type AppName } from "../env";
import { cookieName, hardenCookie } from "./cookies";

type Options = {
  app: AppName;
  isPublic: (pathname: string) => boolean;
  loginPath?: string;
  imgHosts?: string[];
};

// Runs on every request: refreshes the session, sets a nonce-based CSP, and keeps signed-out
// visitors away from private routes. Role checks happen again on the server and in the database.
export async function handleRequest(request: NextRequest, opts: Options) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, { imgHosts: opts.imgHosts });

  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return headers;
  };

  let response = NextResponse.next({ request: { headers: forward() } });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookieOptions: { name: cookieName(opts.app) },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: forward() } });
        for (const { name, value, options } of list) response.cookies.set(name, value, hardenCookie(options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && !opts.isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = opts.loginPath ?? "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Only allow same-site relative redirects after login.
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/") {
  const v = typeof value === "string" ? value : "";
  return /^\/(?!\/)[A-Za-z0-9/_\-?=&%.]*$/.test(v) && !v.includes("\\") ? v : fallback;
}
