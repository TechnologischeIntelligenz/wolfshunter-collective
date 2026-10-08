import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { exportPrivacyRequest } from "../services/privacy-requests.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Response("Invalid request", { status: 400 });
  return Response.json(await exportPrivacyRequest(session.shop, id), {
    headers: {
      "Content-Disposition": `attachment; filename="privacy-request-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
