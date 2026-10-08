import type { LoaderFunctionArgs } from "react-router";

import { DiscoverView } from "../features/discover/discover-view";

const previewNavigation = [
  "Dashboard",
  "Discover",
  "Favorites",
  "Import Lists",
  "My Products",
  "Orders",
  "Fulfillment",
  "Tracking",
  "Analytics",
  "Subscription",
  "Settings",
] as const;

export const loader = ({ request }: LoaderFunctionArgs) => {
  if (process.env.NODE_ENV === "production") {
    throw new Response("Not found", { status: 404 });
  }
  return { previewUrl: new URL(request.url).pathname };
};

export default function PhaseOnePreviewRoute() {
  return (
    <div className="collective-preview-shell">
      <aside className="collective-preview-sidebar">
        <div className="collective-wordmark">
          <img
            className="collective-wordmark-logo"
            src="/wolfshunter-collective-logo.png"
            alt=""
            width="64"
            height="64"
          />
          <div>
            <strong>WOLFSHUNTER</strong>
            <small>COLLECTIVE</small>
          </div>
        </div>
        <nav aria-label="Phase 1 preview navigation">
          <ul>
            {previewNavigation.map((item) => (
              <li key={item} className={item === "Discover" ? "is-active" : ""}>
                <span className="collective-nav-glyph" aria-hidden="true">
                  {item.slice(0, 1)}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </nav>
        <div className="collective-preview-tenant">
          <span>AT</span>
          <div>
            <strong>Phase 1 retailer</strong>
            <small>Fixture tenant</small>
          </div>
        </div>
      </aside>
      <div className="collective-preview-main">
        <div className="collective-preview-topbar">
          <span>Retailer workspace</span>
          <div>
            <span>Local preview</span>
            <strong>GD</strong>
          </div>
        </div>
        <DiscoverView compact />
      </div>
    </div>
  );
}
