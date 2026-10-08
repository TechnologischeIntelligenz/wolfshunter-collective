const base = 'https://wolfshunter-collective-test.limoorange99.workers.dev';
for (const pathname of ['/healthz','/','/auth/login','/app','/app?shop=wolfshunter-ai-dev.myshopify.com&embedded=1']) {
  const start = performance.now();
  try {
    const response = await fetch(base+pathname,{redirect:'manual',signal:AbortSignal.timeout(20000)});
    const body = await response.text();
    const redirect = response.headers.get('location');
    console.log(JSON.stringify({path:pathname,status:response.status,ms:Math.round(performance.now()-start),redirect:redirect ? new URL(redirect,base).origin + new URL(redirect,base).pathname : undefined,
      health:pathname==='/healthz' && response.headers.get('content-type')?.includes('application/json') ? JSON.parse(body) : undefined,
      accessBlocked:body.includes("You don't have permission to view this"),workerError:body.includes('Error 1102')||body.includes('Error 1101'),
      appBridge:body.includes('cdn.shopify.com/shopifycloud/app-bridge.js'), loginForm:body.includes('<form'),bytes:body.length}));
  } catch(error) { console.log(JSON.stringify({path:pathname,failed:true,error:error.name})); }
}
