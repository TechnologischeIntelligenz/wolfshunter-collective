import fs from 'node:fs/promises';
const directory = new URL('../_recovery/shopify-hosted-preview/', import.meta.url);
await fs.mkdir(directory, { recursive:true });
const source = await fs.readFile(new URL('../shopify.app.toml', import.meta.url), 'utf8');
if (!source.includes('51671c87d216d57415143f2ad8729399')) throw new Error('Unexpected Shopify app');
const target = source.replaceAll('https://collective.wolfshunter.com', 'https://wolfshunter-collective-test.limoorange99.workers.dev')
  .replace(/automatically_update_urls_on_dev\s*=\s*true/g, 'automatically_update_urls_on_dev = false');
await fs.writeFile(new URL('shopify.app.toml',directory),target);
await fs.writeFile(new URL('package.json',directory),JSON.stringify({name:'wolfshunter-hosted-dev-preview',private:true,version:'1.0.0'}));
console.log('Prepared dev-shop configuration preview pointing to the hosted Worker. No web server, tunnel, or certificate setup.');
