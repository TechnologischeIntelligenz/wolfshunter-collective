import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type LinksFunction,
} from "react-router";

import collectiveStyles from "./styles/collective.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: collectiveStyles },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <div role="status" style={{ padding: "10px 16px", background: "#fff4ce", color: "#352900", textAlign: "center", fontSize: 14 }}>
          Testversion
        </div>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
