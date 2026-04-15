"use client";

import { createSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Button } from "../../../components/ui/Button";
import { useState } from "react";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setStatus("idle");
      return;
    }
    window.location.href = "/dashboard";
  }

  async function handleMagicLink() {
    setStatus("loading");
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (linkError) setError(linkError.message);
    else setError("Magic link sent. Check your email.");
    setStatus("idle");
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white shadow-sm p-8 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Internal Access</p>
          <h1 className="text-xl font-semibold text-neutral-900">FM Ops Middleware</h1>
          <p className="text-sm text-neutral-600">Sign in with your work account.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-800">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium text-neutral-800">
              <label>Password</label>
              <a href="/reset" className="text-neutral-500 hover:text-neutral-800">
                Forgot?
              </a>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="space-y-2">
          <button
            onClick={handleMagicLink}
            className="w-full text-sm text-neutral-700 underline underline-offset-4"
          >
            Send magic link
          </button>
          <div className="text-xs text-neutral-500">SSO placeholder can be added here.</div>
        </div>
      </div>
    </div>
  );
}
