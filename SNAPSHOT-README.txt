WOLFSHUNTER COLLECTIVE recovery snapshot: 20260918-051720
Includes source, lockfile, .env, consistent SQLite backup and current synchronized catalog/commerce data.
Private backup: contains credentials and session data. Keep locally and do not publish.
Excluded: node_modules, build, caches, CLI credentials, old recovery archives and superseded catalog generations.
Restore: extract into a separate folder, npm ci, npm run setup, npm run build.
Shopify CLI authentication is stored outside this project and is not included.
Catalog: 8237 products, 63 collections; 17 markets and 65 shipping destinations.
This snapshot preserves the current working state; it does not certify every UI flow.
