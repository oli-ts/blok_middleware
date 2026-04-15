"use client";

import Image from "next/image";
import { useState } from "react";
import {
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setStatus("idle");
      return;
    }

    if (rememberMe) {
      localStorage.setItem("blok_remember_email", email);
    } else {
      localStorage.removeItem("blok_remember_email");
    }

    window.location.href = "/dashboard";
  }

  async function handleMagicLink() {
    setStatus("magic");
    setError("");

    const { error: linkError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (linkError) setError(linkError.message);
    else setError("Magic link sent. Check your email.");
    setStatus("idle");
  }

  async function handleOAuth(provider) {
    setStatus(provider);
    setError("");

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setStatus("idle");
    }
  }

  async function handleSSOLogin() {
    const domain = window.prompt("Enter your company domain:");
    if (!domain) return;

    setStatus("sso");
    setError("");

    const { error: ssoError } = await supabase.auth.signInWithSSO({
      domain,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (ssoError) {
      setError(ssoError.message);
      setStatus("idle");
    }
  }

  const loading = status !== "idle";

  return (
    <main className="flex min-h-screen bg-white lg:h-screen lg:overflow-hidden">
      <section className="relative hidden min-h-[260px] w-full overflow-hidden lg:flex lg:h-full lg:w-1/2">
        <Image
          src="/Frame%201.svg"
          alt="Construction architecture"
          fill
          priority
          sizes="50vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/75 via-gray-900/45 to-gray-900/70" />
        <Image
          src="/Frame%206.svg"
          alt=""
          width={420}
          height={420}
          aria-hidden="true"
          className="absolute bottom-8 right-10 z-10 max-w-[42%] opacity-90 drop-shadow-2xl"
        />

      </section>

      <section className="flex min-h-screen w-full items-center justify-center bg-white p-6 lg:h-full lg:w-1/2 lg:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="mb-5 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Building2 size={22} />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">Middleware Platform</div>
                <div className="text-xs text-gray-500">Glenigan to Pipedrive</div>
              </div>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Welcome</h1>
            <p className="text-base text-gray-600">Sign in to your account to continue</p>
          </div>

          {error ? (
            <div role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEmail("");
                  }}
                  className="block h-12 w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="you@company.com"
                  aria-label="Email Address"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setPassword("");
                  }}
                  className="block h-12 w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-10 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                  aria-label="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              <a href="/reset" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {status === "loading" ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : null}
              {status === "loading" ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mb-6 mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-gray-500">Or continue with</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Sign in with Google"
            >
              <GoogleIcon />
              Sign in with Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuth("azure")}
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Sign in with Microsoft"
            >
              <MicrosoftIcon />
              Sign in with Microsoft
            </button>

            <button
              type="button"
              onClick={handleSSOLogin}
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Sign in with SSO"
            >
              <ShieldCheck className="h-5 w-5 text-gray-600" />
              Sign in with SSO
            </button>
          </div>

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={!email || loading}
            className="mt-5 w-full text-center text-sm font-medium text-blue-600 hover:text-blue-500 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {status === "magic" ? "Sending magic link..." : "Email me a magic link"}
          </button>

          <p className="mt-8 text-center text-sm text-gray-600">
            Need an account?{" "}
            <span className="font-medium text-gray-900">
              Ask an administrator for an invite.
            </span>
          </p>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Lock className="h-4 w-4" />
            <span>Secured by encrypted Supabase authentication</span>
          </div>
        </div>
      </section>
    </main>
  );
}
