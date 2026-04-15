"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Button } from "../../../components/ui/Button";

export default function ResetPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");

  async function handleReset(e) {
    e.preventDefault();
    setStatus("loading");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) setMessage(error.message);
    else setMessage("Reset link sent. Check your inbox.");
    setStatus("idle");
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white shadow-sm p-8 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Password Reset</p>
          <h1 className="text-xl font-semibold text-neutral-900">Send reset link</h1>
        </div>
        <form className="space-y-4" onSubmit={handleReset}>
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
          {message ? <p className="text-sm text-neutral-700">{message}</p> : null}
          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Sending..." : "Send link"}
          </Button>
        </form>
      </div>
    </div>
  );
}
