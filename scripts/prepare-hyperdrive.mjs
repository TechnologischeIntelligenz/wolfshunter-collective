import fs from 'node:fs/promises';
import { parseEnv } from 'node:util';
const project = 'roggwnlqgjbrnrwzrjsm';
const saved = parseEnv(await fs.readFile(new URL('../.env.cloudflare-database', import.meta.url), 'utf8'));
if (saved.SUPABASE_PROJECT_REF !== project) throw new Error('Unexpected project');
const url = new URL(saved.MIGRATION_DATABASE_URL);
if (decodeURIComponent(url.username) !== `wolfshunter_app.${project}`) throw new Error('Unexpected app role');
const origin = { scheme: 'postgres', host: `db.${project}.supabase.co`, port: 5432, database: 'postgres', user: 'wolfshunter_app', password: decodeURIComponent(url.password) };
const code = `async () => {
  const listed=await cloudflare.request({method:'GET',path:\`/accounts/\${accountId}/hyperdrive/configs\`,query:{per_page:100}});
  if(!listed.success) return {stage:'list-hyperdrive',errors:listed.errors};
  const previous=listed.result.find(x=>x.name==='wolfshunter-supabase-test');
  if(previous) return {stage:'already-exists',id:previous.id,host:previous.origin.host};
  const r=await cloudflare.request({method:'POST',path:\`/accounts/\${accountId}/hyperdrive/configs\`,body:{name:'wolfshunter-supabase-test',origin:${JSON.stringify(origin)},origin_connection_limit:5,caching:{disabled:true}}});
  return {stage:'create-hyperdrive',success:r.success,errors:r.errors,id:r.result?.id,host:r.result?.origin?.host};
}`;
await fs.writeFile(new URL('../_recovery/create-hyperdrive.json', import.meta.url), JSON.stringify({tool:'execute',arguments:{account_id:'26772071fc212ec3397c645c6c98a350',code}}), {mode:0o600});
console.log(JSON.stringify({ prepared:true, project, tlsMode:'Cloudflare managed TLS', customCertificate:false }));
