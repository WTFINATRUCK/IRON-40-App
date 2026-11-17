import Link from "next/link";
import { AuthForm } from "@iron40/core/components/AuthForm";
import { safeNext } from "@iron40/core/supabase/proxy";
import { signInAction } from "../actions";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <h1>Operator sign in</h1>
      <AuthForm action={signInAction} submit="Sign in" next={safeNext(next, "/")} />
      <p className="muted small">Staff accounts are invite-only. <Link href="/join">Have an invite code?</Link></p>
    </div>
  );
}
