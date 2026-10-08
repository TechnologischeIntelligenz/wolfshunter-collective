import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const { errors } = loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Install WOLFSHUNTER COLLECTIVE">
          <s-text>
            Please install this app from the Shopify App Store.
            Open it from your Shopify Admin after installation.
          </s-text>
          {errors && (
            <s-banner status="critical">
              {errors.shop}
            </s-banner>
          )}
        </s-section>
      </s-page>
    </AppProvider>
  );
}
