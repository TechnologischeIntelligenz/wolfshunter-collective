import { useState } from "react";
import { useLoaderData, useFetcher, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getPrivacyRequests,
  completePrivacyRequest,
} from "../services/privacy-requests.server";
import db from "../db.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const supportPage = Math.max(
    1,
    Math.floor(Number(url.searchParams.get("supportPage")) || 1),
  );
  const [requests, support, totalSupport] = await Promise.all([
    getPrivacyRequests(session.shop),
    db.supportCase.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      skip: (supportPage - 1) * 25,
      take: 25,
      select: { id: true, message: true, answer: true, createdAt: true },
    }),
    db.supportCase.count({ where: { shop: session.shop } }),
  ]);
  return {
    requests,
    support: support.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    supportPage,
    totalSupport,
  };
}
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0 || form.get("confirmed") !== "on")
    return Response.json(
      { error: "Confirm the review before continuing." },
      { status: 400 },
    );
  if (form.get("intent") === "delete-support") {
    await db.supportCase.deleteMany({ where: { id, shop: session.shop } });
    return { ok: true };
  }
  if (form.get("intent") !== "complete")
    return Response.json({ error: "Unknown action" }, { status: 400 });
  await completePrivacyRequest(session.shop, id);
  return { ok: true };
}
function Download({ id }: { id: number }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setError(null);
    setBusy(true);
    const response = await fetch(`/app/privacy-export?id=${id}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `privacy-request-${id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <button
        disabled={busy}
        type="button"
        className="collective-button collective-button-secondary"
        onClick={() =>
          void download()
            .catch(() =>
              setError("Could not download. Please reopen the app and retry."),
            )
            .finally(() => setBusy(false))
        }
      >
        Download order data
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
export default function PrivacyRequestsRoute() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [params, setParams] = useSearchParams();
  const move = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("supportPage", String(page));
    setParams(next);
  };
  const result = fetcher.data as { error?: string } | undefined;
  return (
    <main className="collective-page">
      <h1>Privacy requests</h1>
      <p>
        Showing up to 100 open requests, oldest first. Order erasure runs
        automatically. Review related support conversations and deliver
        requested data to the requester before marking a request complete.
        Downloads remain private to this shop.
      </p>
      {result?.error ? <p role="alert">{result.error}</p> : null}
      {data.requests.length === 0 ? (
        <p>No open privacy requests.</p>
      ) : (
        data.requests.map((row) => (
          <section className="collective-section" key={row.id}>
            <h2>{row.topic.replaceAll("_", " ")}</h2>
            <p>
              {new Date(row.createdAt).toLocaleString()} · {row.orderCount}{" "}
              referenced orders · {row.status}
            </p>
            <Download id={row.id} />
            {row.status !== "COMPLETED" ? (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="complete" />
                <input type="hidden" name="id" value={row.id} />
                <label>
                  <input type="checkbox" name="confirmed" required /> I reviewed
                  related support records and fulfilled the access or erasure
                  request.
                </label>
                <button
                  className="collective-button collective-button-primary"
                  disabled={fetcher.state !== "idle"}
                >
                  Mark complete
                </button>
              </fetcher.Form>
            ) : null}
          </section>
        ))
      )}
      <section className="collective-section">
        <h2>Review support conversations</h2>
        <p>
          Only remove a conversation after verifying that it belongs to the
          request. This cannot be undone.
        </p>
        {data.support.map((row) => (
          <details key={row.id}>
            <summary>
              Conversation {row.id} · {new Date(row.createdAt).toLocaleString()}
            </summary>
            <p>{row.message}</p>
            <p>{row.answer}</p>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="delete-support" />
              <input type="hidden" name="id" value={row.id} />
              <label>
                <input type="checkbox" name="confirmed" required /> Delete this
                related conversation.
              </label>
              <button disabled={fetcher.state !== "idle"}>
                Delete conversation
              </button>
            </fetcher.Form>
          </details>
        ))}
        <p>
          Support page {data.supportPage} of{" "}
          {Math.max(1, Math.ceil(data.totalSupport / 25))}
        </p>
        {data.supportPage > 1 ? (
          <button onClick={() => move(data.supportPage - 1)}>
            Previous conversations
          </button>
        ) : null}
        {data.supportPage * 25 < data.totalSupport ? (
          <button onClick={() => move(data.supportPage + 1)}>
            Next conversations
          </button>
        ) : null}
      </section>
    </main>
  );
}
