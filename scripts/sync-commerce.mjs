import { cliAdmin } from './shopify-cli-admin.mjs';
import { startSourceSync } from '../app/services/source-sync.server.ts';
import { getCatalogSourceShop } from '../app/services/app-admin.server.ts';
import db from '../app/db.server.ts';
process.loadEnvFile('.env');
const shop=getCatalogSourceShop(); if(!shop) throw new Error('Source shop missing');
try {const job=await startSourceSync(cliAdmin(shop),shop,'commerce');const state=await job.completion;console.log(JSON.stringify(state));if(state.status!=='COMPLETED')process.exitCode=1;}finally{await db.$disconnect();}
