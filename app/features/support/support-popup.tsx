import { useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";

type PopupResult = {
  ok?: boolean;
  answer?: string;
  source?: "openai" | "gemini" | "local";
  model?: string;
  error?: string;
};

const STORAGE_KEY = "wolfshunter-support-popup-seen";

export function SupportPopup() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState("Ich brauche Hilfe beim Katalog oder Import.");
  const fetcher = useFetcher<PopupResult>();
  const location = useLocation();
  const result = fetcher.data;
  const supportPath = `/app/support${location.search}`;

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const timer = window.setTimeout(() => setOpen(true), 1400);
        window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
        return () => window.clearTimeout(timer);
      }
    } catch {
      const timer = window.setTimeout(() => setOpen(true), 1400);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, []);

  const close = () => {
    setOpen(false);
    setDismissed(true);
  };

  if (dismissed) {
    return (
      <button
        type="button"
        className="collective-support-launcher"
        onClick={() => {
          setDismissed(false);
          setOpen(true);
        }}
        aria-label="Open support assistant"
      >
        Help
      </button>
    );
  }

  return (
    <aside className={`collective-support-popup ${open ? "is-open" : ""}`} aria-live="polite">
      {!open ? (
        <button
          type="button"
          className="collective-support-launcher is-pulsing"
          onClick={() => setOpen(true)}
          aria-label="Open support assistant"
        >
          Help
        </button>
      ) : (
        <section className="collective-support-popover" aria-label="Support assistant">
          <div className="collective-support-popover-head">
            <div>
              <small>WOLFSHUNTER Support</small>
              <strong>Need help?</strong>
            </div>
            <button type="button" onClick={close} aria-label="Close support popup">
              x
            </button>
          </div>
          <p>Ask about catalog, collections, imports, drafts, settings, returns, or errors.</p>
          <fetcher.Form method="post" action={supportPath} className="collective-support-popup-form">
            <input type="hidden" name="mode" value="merchant_support" />
            <textarea
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              maxLength={1000}
              required
            />
            <button className="collective-button collective-button-primary" type="submit" disabled={fetcher.state !== "idle"}>
              {fetcher.state === "idle" ? "Ask now" : "Checking..."}
            </button>
          </fetcher.Form>
          {result?.answer ? (
            <div className="collective-support-popup-answer">
              <small>{result.model ?? result.source ?? "support"}</small>
              <p>{result.answer}</p>
            </div>
          ) : null}
          <Link className="collective-support-popup-link" to={supportPath}>
            Open full support
          </Link>
        </section>
      )}
    </aside>
  );
}
