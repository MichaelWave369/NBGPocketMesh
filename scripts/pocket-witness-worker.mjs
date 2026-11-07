#!/usr/bin/env node
/**
 * R9 witnessed, dual-signature, permit-only local worker.
 * The trusted supervisor supplies FOUR fixed config paths, never the client.
 */
import {loadExecutorConfig} from '../src/pocket-executor-protocol.mjs';
import {loadPhiIDApprovalPolicy,AUTHORIZED_RECEIPT_SCHEMA} from '../src/pocket-phiid-approval.mjs';
import {loadTrustLifecyclePolicy,executeTrustLifecycleRequest} from '../src/pocket-trust-lifecycle.mjs';
import {assertCurrentPolicyWitness} from '../src/pocket-policy-witness.mjs';

async function readRequest(){
  let bytes=0;const chunks=[];
  for await(const chunk of process.stdin){
    bytes+=chunk.length;
    if(bytes>16384)throw new TypeError('Oversized request');
    chunks.push(chunk);
  }
  if(!bytes)throw new TypeError('Missing request');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
try{
  if(process.argv.length!==6)throw new TypeError('Four operator paths required');
  const executorConfig=loadExecutorConfig(process.argv[2]);
  const approvalPolicy=loadPhiIDApprovalPolicy(process.argv[3]);
  const lifecyclePolicy=loadTrustLifecyclePolicy(process.argv[4]);
  const witnessDir=process.argv[5]; // Never accepted from the stdin request.
  const envelope=await readRequest();
  const result=await executeTrustLifecycleRequest(envelope,{
    executorConfig,approvalPolicy,lifecyclePolicy,
    policyWitnessCheck:()=>assertCurrentPolicyWitness(witnessDir,lifecyclePolicy)
  });
  process.stdout.write(JSON.stringify(result)+'\n');
}catch{
  process.stdout.write(JSON.stringify({
    schema:AUTHORIZED_RECEIPT_SCHEMA,
    authority:'NONE',origin:'SIMULATED_LOCAL',
    status:'REFUSE',reason:'DENIED'
  })+'\n');
  process.exitCode=1;
}
