import Link from "next/link";
import { AuthForm } from "@iron40/core/components/AuthForm";
import { joinAction } from "../actions";

export const metadata = { title: "Join" };

export default function Join() {
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <h1>Create a staff account</h1>
      <p className="muted">Use a work email that isn't a customer or driver account. You'll enter your invite code after confirming it.</p>
      <AuthForm action={joinAction} submit="Create account" newPassword />
      <p><Link href="/login">Back to sign in</Link></p>
    </div>
  );
}
