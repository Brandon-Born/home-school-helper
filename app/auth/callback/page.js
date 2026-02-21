"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "../../../src/lib/supabase-browser.js";
import { AppShell } from "../../components/layout/AppShell.js";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [statusText, setStatusText] = useState("Finishing sign-in...");

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
        } else {
          const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (error) {
              throw error;
            }
          }
        }

        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!session) {
          setStatusText("Sign-in did not complete. Sending you back to the parent screen...");
          router.replace("/parent");
          return;
        }

        setStatusText("You're signed in. Opening the parent screen...");
        router.replace("/parent");
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : "Sign-in could not be completed.");
      }
    }

    finishSignIn();
  }, [router]);

  return (
    <AppShell
      role="auth"
      title="Finishing Sign-In"
      subtitle="We are securely signing you in and preparing your parent screen."
    >
      <div className="console-centered">
        <section className="card card--elevated">
          <h2 className="section-title">Sign-In Status</h2>
          <p className="section-muted">{statusText}</p>
        </section>
      </div>
    </AppShell>
  );
}
