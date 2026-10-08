import fs from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { validateDestination } from './import-sqlite-postgres.mjs';
const env = parseEnv(await fs.readFile(new URL('../.env.cloudflare-database', import.meta.url),'utf8'));
const pool = new pg.Pool({connectionString:validateDestination(env.MIGRATION_DATABASE_URL,'roggwnlqgjbrnrwzrjsm'),ssl:{rejectUnauthorized:true,ca:await fs.readFile(new URL('../_recovery/supabase-prod-ca-2021.crt', import.meta.url),'utf8')},max:1,connectionTimeoutMillis:15000});
try {
  const mode=process.argv[2] ?? 'dev';
  if(!['dev','source'].includes(mode))throw new Error('Use dev or source');
  const shop=mode==='source'?'3ddd6b-2.myshopify.com':'wolfshunter-ai-dev.myshopify.com';
  const result=await pool.query('SELECT "accessToken" FROM public."Session" WHERE shop=$1 AND "isOnline"=false',[shop]);
  if(result.rows.length!==1)throw new Error('Expected one shop offline session');
  const response=await fetch(`https://${shop}/admin/api/2026-07/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':result.rows[0].accessToken},body:JSON.stringify({query:'query HostedSessionCheck { shop { myshopifyDomain } currentAppInstallation { app { apiKey } accessScopes { handle } } }'}),signal:AbortSignal.timeout(20000)});
  const body=await response.json();
  console.log(JSON.stringify({status:response.status,shop:body.data?.shop?.myshopifyDomain,correctApp:body.data?.currentAppInstallation?.app?.apiKey==='51671c87d216d57415143f2ad8729399',grantedScopes:body.data?.currentAppInstallation?.accessScopes?.map(scope=>scope.handle),graphqlErrors:Array.isArray(body.errors)?body.errors.length:body.errors?1:0}));
} catch(error) {console.log(JSON.stringify({failed:true,code:error.code??error.name}));process.exitCode=1;}finally{await pool.end();}
