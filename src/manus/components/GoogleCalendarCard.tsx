import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2, Link2, Link2Off, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = {
  connected: boolean;
  connection_status: string;
  google_account_email?: string | null;
  connected_at?: string | null;
  needs_reconnect?: boolean;
};

type UiState =
  | "idle"
  | "loading_status"
  | "connecting"
  | "adding_event"
  | "disconnecting";

export default function GoogleCalendarCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [ui, setUi] = useState<UiState>("loading_status");
  const [banner, setBanner] = useState<
    | { kind: "success" | "denied" | "expired" | "error"; text: string }
    | null
  >(null);
  const [testEventLink, setTestEventLink] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setUi("loading_status");
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-status", {
        method: "GET",
      });
      if (error) throw error;
      setStatus(data as Status);
    } catch (e) {
      console.error("gcal status failed", e);
      setStatus({ connected: false, connection_status: "unknown" });
    } finally {
      setUi("idle");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Handle callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("google_calendar");
    if (!flag) return;
    if (flag === "connected") {
      setBanner({ kind: "success", text: "Google Agenda conectada." });
      void loadStatus();
    } else if (flag === "denied") {
      setBanner({
        kind: "denied",
        text: "A permissão do Google não foi concedida. Você pode tentar novamente.",
      });
    } else if (flag === "expired") {
      setBanner({
        kind: "expired",
        text: "O link de autorização expirou. Tente novamente.",
      });
    } else if (flag === "error") {
      setBanner({
        kind: "error",
        text: "Não foi possível concluir a conexão. Tente novamente.",
      });
    }
    // Clear the query param so refreshing doesn't re-trigger the banner.
    params.delete("google_calendar");
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
  }, [loadStatus]);

  const connect = async () => {
    setUi("connecting");
    try {
      const { data, error } = await supabase.functions.invoke(
        "google-calendar-oauth-start",
        { body: { redirect_path: "/profile" } },
      );
      if (error) throw error;
      const url = (data as { authorization_url?: string })?.authorization_url;
      if (!url) throw new Error("no_authorization_url");
      window.location.assign(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Não foi possível abrir a autorização do Google", { description: msg });
      setUi("idle");
    }
  };

  const addTestEvent = async () => {
    setUi("adding_event");
    setTestEventLink(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "google-calendar-create-test-event",
        { body: {} },
      );
      if (error) throw error;
      const link = (data as { html_link?: string })?.html_link ?? null;
      setTestEventLink(link);
      toast.success("Evento de teste adicionado à sua Google Agenda.");
      if ((data as { deduped?: boolean })?.deduped) {
        toast.message("Um evento equivalente já existia — reutilizamos o mesmo.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("needs_reconnect") || msg.includes("401")) {
        toast.error("Sua conexão expirou. Reconecte sua Google Agenda.");
        void loadStatus();
      } else {
        toast.error("Não foi possível criar o evento de teste.", { description: msg });
      }
    } finally {
      setUi("idle");
    }
  };

  const disconnect = async () => {
    setUi("disconnecting");
    try {
      const { error } = await supabase.functions.invoke(
        "google-calendar-disconnect",
        { body: {} },
      );
      if (error) throw error;
      toast.success("Google Agenda desconectada.");
      setStatus({ connected: false, connection_status: "disconnected" });
      setTestEventLink(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Falha ao desconectar.", { description: msg });
    } finally {
      setUi("idle");
    }
  };

  const isConnected = status?.connected === true;
  const needsReconnect = status?.needs_reconnect === true;

  return (
    <div
      className="p-8"
      style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}
    >
      <div className="flex items-center gap-3 mb-2">
        <CalendarPlus size={20} style={{ color: "var(--aa-olive-dark)" }} />
        <h2
          className="font-serif text-2xl"
          style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}
        >
          Integração com Google Agenda
        </h2>
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--aa-text-mid)" }}>
        Conecte sua agenda para adicionar os eventos e workshops da Alchemy Academy que você
        escolher participar.
      </p>

      {banner && (
        <div
          className="mb-4 flex items-start gap-2 px-3 py-2 text-sm"
          style={{
            backgroundColor:
              banner.kind === "success" ? "rgba(60,120,60,0.08)" : "rgba(180,80,40,0.08)",
            border: "1px solid var(--aa-cream-dark)",
            color: "var(--aa-text-dark)",
          }}
          role="status"
        >
          {banner.kind === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {ui === "loading_status" && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
          <Loader2 size={16} className="animate-spin" /> Verificando conexão…
        </div>
      )}

      {ui !== "loading_status" && !isConnected && !needsReconnect && (
        <button
          type="button"
          onClick={connect}
          disabled={ui === "connecting"}
          className="flex items-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--aa-olive-dark)", color: "white", fontWeight: 500 }}
        >
          {ui === "connecting" ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Conectando…
            </>
          ) : (
            <>
              <Link2 size={14} /> Conectar minha Google Agenda
            </>
          )}
        </button>
      )}

      {ui !== "loading_status" && needsReconnect && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--aa-text-dark)" }}>
            Sua conexão com o Google expirou ou foi revogada.
          </p>
          <button
            type="button"
            onClick={connect}
            disabled={ui === "connecting"}
            className="flex items-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
            style={{ backgroundColor: "var(--aa-olive-dark)", color: "white", fontWeight: 500 }}
          >
            {ui === "connecting" ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Reconectando…
              </>
            ) : (
              <>
                <RefreshCw size={14} /> Reconectar Google Agenda
              </>
            )}
          </button>
        </div>
      )}

      {ui !== "loading_status" && isConnected && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--aa-text-dark)" }}>
            Google Agenda conectada
            {status?.google_account_email ? (
              <>
                {" "}
                — <span style={{ color: "var(--aa-text-mid)" }}>{status.google_account_email}</span>
              </>
            ) : null}
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addTestEvent}
              disabled={ui === "adding_event"}
              className="flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
              style={{
                backgroundColor: "var(--aa-olive-dark)",
                color: "white",
                fontWeight: 500,
              }}
            >
              {ui === "adding_event" ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Adicionando evento…
                </>
              ) : (
                <>
                  <CalendarPlus size={14} /> Adicionar evento de teste
                </>
              )}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={ui === "disconnecting"}
              className="flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
              style={{
                backgroundColor: "var(--aa-cream-dark)",
                color: "var(--aa-olive-dark)",
                fontWeight: 500,
              }}
            >
              {ui === "disconnecting" ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Desconectando…
                </>
              ) : (
                <>
                  <Link2Off size={14} /> Desconectar Google Agenda
                </>
              )}
            </button>
          </div>
          {testEventLink && (
            <a
              href={testEventLink}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm underline"
              style={{ color: "var(--aa-olive-dark)" }}
            >
              Abrir evento de teste no Google Calendar →
            </a>
          )}
        </div>
      )}
    </div>
  );
}