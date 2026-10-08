import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const child = spawn(process.execPath,[fileURLToPath(new URL('../node_modules/wrangler/wrangler-dist/cli.js',import.meta.url)),'tail','wolfshunter-collective-test','--format','json'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let buffer='';
let depth=0,quoted=false,escaped=false,start=-1;
child.stderr.resume();
child.stdout.on('data',chunk=>{
  for(const char of chunk.toString()){
    if(start<0){if(char!=='{')continue;start=0;buffer='';depth=0;}
    buffer+=char;
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
    if(char==='"')quoted=true;
    else if(char==='{')depth++;
    else if(char==='}'&&--depth===0){
      try{const event=JSON.parse(buffer);let pathname;try{pathname=new URL(event.event?.request?.url).pathname;}catch{}
        console.log(JSON.stringify({outcome:event.outcome,path:pathname,status:event.event?.response?.status,cpuTime:event.cpuTime,wallTime:event.wallTime,exceptions:event.exceptions?.map(error=>({name:error.name,message:String(error.message).replace(/https?:\/\/\S+/g,'[URL]').replace(/[a-zA-Z0-9_-]{40,}/g,'[redacted]').slice(0,240)}))}));
      }catch{}
      start=-1;buffer='';
    }
  }
});
const timer=setTimeout(()=>child.kill(),45000);
await new Promise(resolve=>child.once('exit',resolve));
clearTimeout(timer);
