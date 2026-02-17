"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "../../../src/lib/supabase-browser.js";
import { AppShell } from "../../components/layout/AppShell.js";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [statusText, setStatusText] = useState("Completing sign-in...");

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    async function finishSignIn() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        }

        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!session) {
          setStatusText("Sign-in did not return a session. Redirecting...");
          router.replace("/parent");
          return;
        }

        setStatusText("Sign-in successful. Redirecting to parent console...");
        router.replace("/parent");
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : "Sign-in callback failed.");
      }
    }

    finishSignIn();
  }, [router]);

  return (
    <AppShell
      role="auth"
      title="Completing Sign-In"
      subtitle="Finishing secure parent authentication and preparing your console."
    >
      <div className="console-centered">
        <section className="card card--elevated">
          <h2 className="section-title">Authentication Callback</h2>
          <p className="section-muted">{statusText}</p>
        </section>
      </div>
    </AppShell>
  );
}
