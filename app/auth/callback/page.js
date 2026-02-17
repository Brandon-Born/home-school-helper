"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "../../../src/lib/supabase-browser.js";

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
    <main style={{ maxWidth: 680, margin: "0 auto", padding: 24 }}>
      <h1>Authentication Callback</h1>
      <p>{statusText}</p>
    </main>
  );
}
