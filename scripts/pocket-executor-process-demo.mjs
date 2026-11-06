/**
 * Process-boundary demonstration. The signer remains in the parent process.
 * The child sees only an operator-owned public-key config and signed permit.
 * No network connection, remote service, stored private key, or real device.
 */
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA,REQUEST_SCHEMA} from '../src/pocket-executor-protocol.mjs';

const folder=mkdtempSync(join(tmpdir(),'pocket-worker-demo-'));
const ledgerDir=join(folder,'spent');
mkdirSync(ledgerDir,{mode:0o700});
const pair=generateKeyPairSync('ed25519');
const configFile=join(folder,'operator.json');
writeFileSync(configFile,JSON.stringify({
  schema:CONFIG_SCHEMA,
  ledgerDir,
  trustedKeys:{'local-demo':pair.publicKey.export({format:'pem',type:'spki'})},
  allowedProfiles:['observe','triage','health']
}),{mode:0o600,flag:'wx'});
function invoke(envelope){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,
      [fileURLToPath(new URL('./pocket-executor-worker.mjs',import.meta.url)),configFile],
      {stdio:['pipe','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''}});
    let stdout='',stderr='';
    child.stdout.on('data',b=>stdout+=b);
    child.stderr.on('data',b=>stderr+=b);
    child.on('error',reject);
    child.on('close',code=>{
      try{resolve({code,response:JSON.parse(stdout.trim()),stderr});}
      catch(err){reject(err);}
    });
    child.stdin.end(JSON.stringify(envelope));
  });
}
try{
  const request=await prepareExecutionRequest({library:createDemoLibrary(),profile:'health'});
  const permit=signExecutionRequest(request,{keyId:'local-demo',privateKey:pair.privateKey});
  const envelope={schema:REQUEST_SCHEMA,permit};
  const first=await invoke(envelope);
  const replay=await invoke(envelope);
  if(first.code!==0||first.response.status!=='PERFORM'||
     replay.code===0||replay.response.status!=='REFUSE')
    throw new Error('One-shot signed executor demo failed');
  console.log(JSON.stringify({
    schema:'NBGPocketMesh.ExecutorProcessDemo.v1',origin:'SIMULATED_LOCAL',authority:'NONE',
    first:{status:first.response.status,receiptSha256:first.response.receipt.receiptSha256,
      outputSha256:first.response.receipt.outputSha256},
    replay:{status:replay.response.status,exitCode:replay.code},
    caveat:'Process-separated stdin worker using demo-only ephemeral signer and synthetic fixtures. Not authenticated human consent or a sandbox.'
  },null,2));
}finally{
  // Never clear the replay ledger in a real service: this demo alone owns and
  // destroys the entire temporary fixture directory.
  rmSync(folder,{force:true,recursive:true});
}
