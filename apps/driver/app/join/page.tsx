import Link from "next/link";
import { AuthForm } from "@iron40/core/components/AuthForm";
import { joinAction } from "../actions";

export const metadata = { title: "Join" };

export default function Join() {
  return (
    <div className="stack">
      <h1>Create a driver account</h1>
      <p className="muted">
        Use an email that isn't already a customer account. After you confirm it, sign in and enter the invite code from
        your dispatcher.
      </p>
      <AuthForm action={joinAction} submit="Create account" newPassword />
      <p><Link href="/login">I already have an account</Link></p>
    </div>
  );
}
