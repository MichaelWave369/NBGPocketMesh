#!/usr/bin/env node
/**
 * One-shot local PhiID-shaped approval worker. Not a real PhiID login.
 * Signer private keys are never loaded. Only a signed permit plus a distinct
 * Ed25519 approval, operator-owned policies, and fixed reviewed albums.
 */
import {loadExecutorConfig} from '../src/pocket-executor-protocol.mjs';
import {
  AUTHORIZED_RECEIPT_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,
  loadPhiIDApprovalPolicy,executePhiIDAuthorizedRequest
} from '../src/pocket-phiid-approval.mjs';

const MAX_BYTES=16_384;
async function boundedInput(){
  let total=0;const chunks=[];
  for await(const chunk of process.stdin){
    total+=chunk.byteLength;
    if(total>MAX_BYTES)throw new TypeError('Request too large');
    chunks.push(chunk);
  }
  if(!total)throw new TypeError('No request');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
try{
  if(process.argv.length!==4)throw new TypeError('Two operator config paths required');
  const executorConfig=loadExecutorConfig(process.argv[2]);
  const approvalPolicy=loadPhiIDApprovalPolicy(process.argv[3]);
  const envelope=await boundedInput();
  if(envelope?.schema!==AUTHORIZED_REQUEST_SCHEMA)
    throw new TypeError('Unknown request');
  const record=await executePhiIDAuthorizedRequest(envelope,{executorConfig,approvalPolicy});
  process.stdout.write(JSON.stringify(record)+'\n');
}catch{
  process.stdout.write(JSON.stringify({
    schema:AUTHORIZED_RECEIPT_SCHEMA,
    origin:'SIMULATED_LOCAL',authority:'NONE',
    status:'REFUSE',reason:'DENIED'
  })+'\n');
  process.exitCode=1;
}
