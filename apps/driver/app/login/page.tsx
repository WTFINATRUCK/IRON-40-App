import Link from "next/link";
import { AuthForm } from "@iron40/core/components/AuthForm";
import { safeNext } from "@iron40/core/supabase/proxy";
import { signInAction } from "../actions";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="stack">
      <h1>Driver sign in</h1>
      <AuthForm action={signInAction} submit="Sign in" next={safeNext(next, "/")} />
      <p className="muted">
        New driver? Your dispatcher gives you an invite code. <Link href="/join">Create your account</Link>
      </p>
    </div>
  );
}
