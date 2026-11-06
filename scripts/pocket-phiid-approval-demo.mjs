/**
 * Offline two-signer demo. This is not OIDC authentication or real PhiID
 * approval: identity is only a synthetic issuer/sub assertion signed by a
 * separate local test key, with an operator-controlled allowlist.
 */
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA} from '../src/pocket-executor-protocol.mjs';
import {
  APPROVAL_POLICY_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,
  signPhiIDApproval
} from '../src/pocket-phiid-approval.mjs';

const base=mkdtempSync(join(tmpdir(),'pocket-phiid-approval-demo-'));
const ledgerDir=join(base,'spent');
mkdirSync(ledgerDir,{mode:0o700});
const permits=generateKeyPairSync('ed25519');
const approvals=generateKeyPairSync('ed25519');
const principal={iss:'https://phiid.example.invalid/realms/demo',sub:'synthetic-user-369'};
const execConfig=join(base,'exec.json'),approvalConfig=join(base,'approval.json');
writeFileSync(execConfig,JSON.stringify({
  schema:CONFIG_SCHEMA,ledgerDir,
  allowedProfiles:['health'],
  trustedKeys:{'permit-local':permits.publicKey.export({format:'pem',type:'spki'})}
}),{mode:0o600,flag:'wx'});
writeFileSync(approvalConfig,JSON.stringify({
  schema:APPROVAL_POLICY_SCHEMA,policyEpoch:1,
  allowedSubjects:[principal],revokedApprovalIds:[],
  trustedApprovers:{'approval-local':approvals.publicKey.export({format:'pem',type:'spki'})}
}),{mode:0o600,flag:'wx'});
const worker=fileURLToPath(new URL('./pocket-phiid-executor-worker.mjs',import.meta.url));
function invoke(envelope){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[worker,execConfig,approvalConfig],{
      stdio:['pipe','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''}
    });
    let stdout='';
    child.stdout.on('data',b=>stdout+=b);
    child.stderr.resume();
    child.on('error',reject);
    child.on('close',code=>{
      try{resolve({code,response:JSON.parse(stdout.trim())});}
      catch(e){reject(e);}
    });
    child.stdin.end(JSON.stringify(envelope));
  });
}
try{
  const request=await prepareExecutionRequest({library:createDemoLibrary(),profile:'health'});
  const permit=signExecutionRequest(request,{privateKey:permits.privateKey,keyId:'permit-local'});
  const approval=signPhiIDApproval({permit,subject:principal,
    privateKey:approvals.privateKey,authorityKeyId:'approval-local'});
  const envelope={schema:AUTHORIZED_REQUEST_SCHEMA,permit,approval};
  const first=await invoke(envelope);
  const replay=await invoke(envelope);
  const unsignedConsent=await invoke({
    schema:AUTHORIZED_REQUEST_SCHEMA,permit,
    approval:{schema:'phiid.local-consent-receipt/0.1',status:'recorded_not_enforced'}
  });
  if(first.code!==0||first.response.status!=='PERFORM'||
     replay.response.status!=='REFUSE'||unsignedConsent.response.status!=='REFUSE')
    throw new Error('Signed approval handshake failed');
  console.log(JSON.stringify({
    schema:'NBGPocketMesh.PhiIDApprovalDemo.v0',
    origin:'SIMULATED_LOCAL',authority:'NONE',
    signedExecution:first.response.status,
    approvalReceiptSha256:first.response.receiptSha256,
    outputSha256:first.response.outputSha256,
    replayRefused:replay.response.status==='REFUSE',
    phiidR2ConsentRefused:unsignedConsent.response.status==='REFUSE',
    caveat:'Identity fields are invented and signer-declared. This is two-key local authorization evidence, not OIDC verification or real PhiID login.'
  },null,2));
}finally{
  // Demo-only temporary state. Never erase the replay ledger in real use.
  rmSync(base,{recursive:true,force:true});
}
