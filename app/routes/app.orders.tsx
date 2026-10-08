import { useEffect } from "react";
import {
  useLoaderData,
  useFetcher,
  useSearchParams,
  useRevalidator,
} from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { OrdersView } from "../features/orders/orders-view";
import {
  getRetailerOrders,
  startOrderSync,
  getOrderSyncState,
} from "../services/retailer-orders.server";
import { authenticate } from "../shopify.server";
import { getSessionRole } from "../services/app-role.server";

async function context(request: Request) {
  const authenticated = await authenticate.admin(request);
  if (getSessionRole(authenticated.session) === "supplier")
    throw new Response("Forbidden", { status: 403 });
  return authenticated;
}
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await context(request);
  await startOrderSync(admin, session.shop);
  const sync = await getOrderSyncState(session.shop);
  return {
    shop: session.shop,
    ...(await getRetailerOrders(
      session.shop,
      Number(new URL(request.url).searchParams.get("page") || 1),
    )),
    syncError: sync.error,
    checkedAt: sync.checkedAt,
    syncStatus: sync.status,
  };
}
export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await context(request);
  await startOrderSync(admin, session.shop, true);
  return { ok: true };
}
export default function OrdersRoute() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [params, setParams] = useSearchParams();
  const revalidator = useRevalidator();
  useEffect(() => {
    if (data.syncStatus !== "RUNNING") return;
    const timer = setInterval(() => {
      void revalidator.revalidate();
    }, 5000);
    return () => clearInterval(timer);
  }, [data.syncStatus, revalidator]);
  const result = fetcher.data as { error?: string } | undefined;
  const move = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    setParams(next);
  };
  return (
    <>
      <div className="collective-settings-actions">
        <fetcher.Form method="post">
          <button
            className="collective-button collective-button-primary"
            disabled={fetcher.state !== "idle" || data.syncStatus === "RUNNING"}
          >
            {data.syncStatus === "RUNNING"
              ? "Synchronizing..."
              : "Synchronize orders"}
          </button>
        </fetcher.Form>
        {data.checkedAt ? (
          <span>Last checked: {new Date(data.checkedAt).toLocaleString()}</span>
        ) : null}
      </div>
      {data.syncError || result?.error ? (
        <p role="alert">{result?.error || data.syncError}</p>
      ) : null}
      <OrdersView shop={data.shop} orders={data.orders} />
      <nav
        className="collective-settings-actions"
        aria-label="Order pagination"
      >
        <button disabled={data.page <= 1} onClick={() => move(data.page - 1)}>
          Previous
        </button>
        <span>
          {data.total} saved orders · Page {data.page} / {data.pageCount}
        </span>
        <button
          disabled={data.page >= data.pageCount}
          onClick={() => move(data.page + 1)}
        >
          Next
        </button>
      </nav>
    </>
  );
}
