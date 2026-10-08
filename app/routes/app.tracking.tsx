import { FoundationRouteView } from "../features/foundation/foundation-route-view";
import { authenticatedRetailerLoader } from "../services/authenticated-app-loader.server";

export { authenticatedRetailerLoader as loader };

export default function TrackingRoute() {
  return (
    <FoundationRouteView
      eyebrow="Shipment visibility"
      title="Tracking"
      description="Verified carrier events and Shopify tracking synchronization will appear here."
      emptyTitle="No shipments are being monitored."
      emptyDescription="Tracking starts only after a mapped Network Order reaches a verified shipment state."
    />
  );
}
