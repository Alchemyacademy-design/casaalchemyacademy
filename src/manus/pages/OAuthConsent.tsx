import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Local typed wrapper for the beta `supabase.auth.oauth` namespace. Keeps
// this file compiling regardless of the installed @supabase/supabase-js
// version, and never leaks into other parts of the app.
interface OAuthClient {
  name?: string;
  logo_uri?: string | null;
}
interface AuthorizationDetails {
  client?: OAuthClient;
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
}
interface OAuthNamespace {
  getAuthorizationDetails(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization(id: string): Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization(id: string): Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
}
function getOAuth(): OAuthNamespace | null {
  const authAny = (supabase as unknown as { auth: Record<string, unknown> }).auth;
  const ns = authAny["oauth"] as OAuthNamespace | undefined;
  return ns ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const oauth = getOAuth();
      if (!oauth) {
        setError(
          "OAuth 2.1 is not enabled on this Supabase project. Enable it in the Supabase dashboard (Auth → OAuth server), then reload this page.",
        );
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the FULL consent URL so login/social/signup all return here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: err } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) {
        setError(err.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const oauth = getOAuth();
    if (!oauth) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card border-border/50">
        <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--aa-olive-dark)" }}>
          Connect an app to your account
        </h1>
        <p className="text-sm text-foreground/70 mb-6">
          Review what this app is asking for before you approve.
        </p>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && !details && (
          <p className="text-sm text-foreground/70">Loading authorization request…</p>
        )}

        {details && (
          <>
            <div className="mb-6">
              <p className="text-base text-foreground">
                <span className="font-medium">{details.client?.name ?? "An external app"}</span> wants
                to connect to your Alchemy Academy account.
              </p>
              <p className="text-sm text-foreground/70 mt-2">
                It will be able to act on your behalf using the same permissions you have in this app.
              </p>
              {details.scopes && details.scopes.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-sm text-foreground/80">
                  {details.scopes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1"
                style={{ backgroundColor: "var(--aa-gold)" }}
              >
                {busy ? "Working…" : "Approve"}
              </Button>
              <Button
                type="button"
                disabled={busy}
                variant="outline"
                onClick={() => decide(false)}
                className="flex-1"
              >
                Deny
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}