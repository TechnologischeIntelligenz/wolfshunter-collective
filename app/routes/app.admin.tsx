import { useEffect } from "react";
import { readSourceCommerce } from "../services/source-commerce.server";
import type { LoaderFunctionArgs } from "react-router";
import {
  startSourceSync,
  readSourceSyncState,
} from "../services/source-sync.server";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";

import { AdminSettingsView } from "../features/admin/admin-settings-view";
import {
  getCatalogSourceShop,
  appAdminConfigurationState,
  isAppAdminSession,
} from "../services/app-admin.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  if (!isAppAdminSession(session)) {
    throw new Response("Forbidden", { status: 403 });
  }

  const source = getCatalogSourceShop();
  return {
    configuration: appAdminConfigurationState(),
    commerce: source ? await readSourceCommerce(source) : null,
    syncState: source ? await readSourceSyncState(source) : null,
  };
}

export async function action({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  if (!isAppAdminSession(session))
    throw new Response("Forbidden", { status: 403 });
  try {
    await startSourceSync(admin, session.shop, "commerce");
    return { ok: true };
  } catch {
    return Response.json(
      {
        error:
          "Could not start shipping and policy sync. Check source access or a running sync.",
      },
      { status: 409 },
    );
  }
}

export default function AppAdminRoute() {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const { configuration, commerce, syncState } = useLoaderData<typeof loader>();
  useEffect(() => {
    if (syncState?.status !== "RUNNING") return;
    const timer = setInterval(() => {
      void revalidator.revalidate();
    }, 5000);
    return () => clearInterval(timer);
  }, [syncState?.status, revalidator]);
  const result = fetcher.data as { error?: string } | undefined;
  return (
    <>
      <fetcher.Form method="post" className="collective-settings-actions">
        <button
          className="collective-button collective-button-primary"
          disabled={fetcher.state !== "idle" || syncState?.status === "RUNNING"}
        >
          Synchronize shipping, markets and policies
        </button>
        <span aria-live="polite">{syncState?.message}</span>
      </fetcher.Form>
      {result?.error ? <p role="alert">{result.error}</p> : null}
      <AdminSettingsView configuration={configuration} commerce={commerce} />
    </>
  );
}
