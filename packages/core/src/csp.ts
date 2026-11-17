// Content-Security-Policy with a per-request nonce. Next.js reads the nonce from the request header
// and stamps it on its own scripts, so no injected inline script can run.
// Static security headers (HSTS, frame, referrer, permissions) live in each app's next.config.ts.
export function buildCsp(nonce: string, opts: { imgHosts?: string[] } = {}) {
  const dev = process.env.NODE_ENV !== "production";
  const img = ["'self'", "data:", "blob:", ...(opts.imgHosts ?? [])].join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img}`,
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
