import { FoundationRouteView } from "../features/foundation/foundation-route-view";
import { authenticatedRetailerLoader } from "../services/authenticated-app-loader.server";

export { authenticatedRetailerLoader as loader };

export default function AnalyticsRoute() {
  return (
    <FoundationRouteView
      eyebrow="Verified performance"
      title="Analytics"
      description="Retail revenue, wholesale cost, margin, and fulfillment performance—derived only from recorded data."
      emptyTitle="There is no verified activity to analyze."
      emptyDescription="Collective will never invent performance metrics. Analytics begins after real, tenant-scoped commerce events exist."
    />
  );
}
