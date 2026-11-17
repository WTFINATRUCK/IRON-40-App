import Link from "next/link";
import { AuthForm } from "@iron40/core/components/AuthForm";
import { signUpAction } from "../auth-actions";

export const metadata = { title: "Create account" };

export default function Signup() {
  return (
    <div className="wrap page stack">
      <h1>Create an account</h1>
      <p className="muted">
        After you confirm your email, you'll add your name, date of birth and a photo of your ID. We review it once,
        then you can order.
      </p>
      <AuthForm action={signUpAction} submit="Create account" newPassword>
        <label className="choice">
          <input type="checkbox" name="adult" required /> I am 21 or older.
        </label>
        <label className="choice">
          <input type="checkbox" name="terms" required /> I agree to have my ID checked before ordering and at delivery.
        </label>
      </AuthForm>
      <p>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
