export interface ShopifyCollectionOption {
  id: string;
  title: string;
}

export async function getShopifyCollectionOptions(
  admin: { graphql: (query: string) => Promise<Response> },
): Promise<ShopifyCollectionOption[]> {
  try {
    const response = await admin.graphql(`#graphql
      query RetailerCollectionOptions {
        collections(first: 250) {
          nodes { id title }
        }
      }
    `);
    const payload = (await response.json()) as {
      data?: { collections?: { nodes?: ShopifyCollectionOption[] } };
    };
    if (!response.ok) return [];
    return (payload.data?.collections?.nodes ?? []).filter(
      (collection) => Boolean(collection.id && collection.title),
    );
  } catch (error) {
    console.error("[retailer-collections] Shopify collection query failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return [];
  }
}
