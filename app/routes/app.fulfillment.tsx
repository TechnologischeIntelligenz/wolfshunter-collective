import { FulfillmentView } from "../features/fulfillment/fulfillment-view";
import { authenticatedRetailerLoader } from "../services/authenticated-app-loader.server";

export { authenticatedRetailerLoader as loader };

export default function FulfillmentRoute() {
  return <FulfillmentView />;
}
