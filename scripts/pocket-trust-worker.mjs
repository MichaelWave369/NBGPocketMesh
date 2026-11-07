#!/usr/bin/env node
/**
 * R8 one-shot, dual-signature, permit-only worker with operator-owned
 * key lifecycle policy and local audit journal. No network listener.
 */
import {loadExecutorConfig} from '../src/pocket-executor-protocol.mjs';
import {
  AUTHORIZED_RECEIPT_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,loadPhiIDApprovalPolicy
} from '../src/pocket-phiid-approval.mjs';
import {
  loadTrustLifecyclePolicy,executeTrustLifecycleRequest
} from '../src/pocket-trust-lifecycle.mjs';

const MAX_INPUT_BYTES=16384;
async function readBounded(){
  let n=0;const chunks=[];
  for await(const chunk of process.stdin){
    n+=chunk.length;
    if(n>MAX_INPUT_BYTES)throw new TypeError('Oversized permit request');
    chunks.push(chunk);
  }
  if(!n)throw new TypeError('Missing permit request');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
try{
  if(process.argv.length!==5)
    throw new TypeError('Three operator-only paths required');
  const executorConfig=loadExecutorConfig(process.argv[2]);
  const approvalPolicy=loadPhiIDApprovalPolicy(process.argv[3]);
  const lifecyclePolicy=loadTrustLifecyclePolicy(process.argv[4]);
  const envelope=await readBounded();
  const response=await executeTrustLifecycleRequest(envelope,{
    executorConfig,approvalPolicy,lifecyclePolicy
  });
  process.stdout.write(JSON.stringify(response)+'\n');
}catch{
  // No caller-controlled request strings, key details, raw subjects,
  // local file paths or stack traces leave the process.
  process.stdout.write(JSON.stringify({
    schema:AUTHORIZED_RECEIPT_SCHEMA,origin:'SIMULATED_LOCAL',
    authority:'NONE',status:'REFUSE',reason:'DENIED'
  })+'\n');
  process.exitCode=1;
}
