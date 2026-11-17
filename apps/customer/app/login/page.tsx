import Link from "next/link";
import { AuthForm } from "@iron40/core/components/AuthForm";
import { safeNext } from "@iron40/core/supabase/proxy";
import { signInAction } from "../auth-actions";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="wrap page stack">
      <h1>Sign in</h1>
      <AuthForm action={signInAction} submit="Sign in" next={safeNext(next, "/")} />
      <p>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </div>
  );
}
