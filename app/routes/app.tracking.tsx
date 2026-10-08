import { FoundationRouteView } from "../features/foundation/foundation-route-view";
import { authenticatedRetailerLoader } from "../services/authenticated-app-loader.server";

export { authenticatedRetailerLoader as loader };

export default function TrackingRoute() {
  return (
    <FoundationRouteView
      eyebrow="Shipment visibility"
      title="Tracking"
      description="Tracking is planned for a later release and is not active in the current retailer workflow."
      emptyTitle="Tracking is not active in V1."
      emptyDescription="No carrier events are being collected or synchronized. This area remains reserved for the verified fulfillment and carrier workflow."
    />
  );
}
