import { DatabaseSync } from 'node:sqlite';

const shop = 'wolfshunter-ai-dev.myshopify.com';
const expectedClientId = '51671c87d216d57415143f2ad8729399';
const sqlite = new DatabaseSync('prisma/dev.sqlite', { readOnly: true });
const session = sqlite.prepare('SELECT shop, isOnline, scope, expires, accessToken FROM Session WHERE shop = ? ORDER BY isOnline ASC LIMIT 1').get(shop);
sqlite.close();
if (!session?.accessToken) {
  console.log(JSON.stringify({ shop, sessionFound: false }));
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': session.accessToken },
      body: JSON.stringify({ query: "query CollectiveHostingReadiness { shop { name myshopifyDomain } appByKey(apiKey: \"51671c87d216d57415143f2ad8729399\") { id title apiKey embedded published requestedAccessScopes { handle } installation { id launchUrl accessScopes { handle } } } }" }),
      signal: AbortSignal.timeout(30000),
    });
    const payload = await response.json();
    const app = payload.data?.appByKey;
    console.log(JSON.stringify({
      checkedAt: new Date().toISOString(), requestedShop: shop, httpStatus: response.status,
      sessionFound: true, offlineSession: !session.isOnline, storedScopes: session.scope?.split(',') ?? [],
      shopMatched: payload.data?.shop?.myshopifyDomain === shop,
      app: app ? {
        id: app.id, title: app.title, expectedClientId: app.apiKey === expectedClientId,
        embedded: app.embedded, published: app.published, installed: Boolean(app.installation),
        launchUrl: app.installation?.launchUrl,
        requestedScopes: app.requestedAccessScopes?.map(s => s.handle),
        grantedScopes: app.installation?.accessScopes?.map(s => s.handle),
      } : null,
      graphqlErrors: Array.isArray(payload.errors) ? payload.errors.map(e => ({ message: e.message, code: e.extensions?.code })) : [],
      apiError: typeof payload.errors === 'string' ? (response.status === 401 ? 'API credentials rejected' : 'API request rejected') : null,
    }, null, 2));
    if (!response.ok || payload.errors?.length || !app?.installation || app.apiKey !== expectedClientId) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ shop, sessionFound: true, requestFailed: true, errorName: error?.name, causeCode: error?.cause?.code }));
    process.exitCode = 1;
  }
}
