import type { AppName } from "../env";

// Each app has its own cookie name, so sessions never cross between customer, driver and ops,
// even on localhost where ports share cookies.
export function cookieName(app: AppName) {
  return `i40-${app}`;
}

// Session cookies are HttpOnly: no browser JavaScript in these apps ever touches Supabase directly,
// so an injected script cannot read the session.
export function hardenCookie<T extends object | undefined>(options: T) {
  return {
    ...(options ?? {}),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
