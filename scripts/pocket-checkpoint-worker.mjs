#!/usr/bin/env node
/**
 * R10 additive signed-checkpoint one-shot executor.
 * Five paths are SUPERVISOR controlled; no private signer in this process.
 */
import {loadExecutorConfig} from '../src/pocket-executor-protocol.mjs';
import {loadPhiIDApprovalPolicy,AUTHORIZED_RECEIPT_SCHEMA} from '../src/pocket-phiid-approval.mjs';
import {loadTrustLifecyclePolicy,executeTrustLifecycleRequest} from '../src/pocket-trust-lifecycle.mjs';
import {loadCheckpointTrustConfig,assertSignedTrustCheckpoint} from '../src/pocket-signed-checkpoint.mjs';

async function readRequest(){
  const chunks=[];let total=0;
  for await(const chunk of process.stdin){
    total+=chunk.byteLength;
    if(total>16384)throw new TypeError('Request exceeds 16 KiB');
    chunks.push(chunk);
  }
  if(!total)throw new TypeError('No signed request');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
try{
  if(process.argv.length!==7)throw new TypeError('Five operator paths required');
  const executorConfig=loadExecutorConfig(process.argv[2]);
  const approvalPolicy=loadPhiIDApprovalPolicy(process.argv[3]);
  const lifecyclePolicy=loadTrustLifecyclePolicy(process.argv[4]);
  const witnessDir=process.argv[5];
  const trustConfig=loadCheckpointTrustConfig(process.argv[6]);
  const envelope=await readRequest();
  const result=await executeTrustLifecycleRequest(envelope,{
    executorConfig,approvalPolicy,lifecyclePolicy,
    policyWitnessCheck:()=>assertSignedTrustCheckpoint({
      witnessDir,lifecyclePolicy,trustConfig
    })
  });
  // The worker intentionally returns no private credentials, raw subject,
  // fixture, report or checkpoint content.
  process.stdout.write(JSON.stringify(result)+'\n');
}catch{
  process.stdout.write(JSON.stringify({
    schema:AUTHORIZED_RECEIPT_SCHEMA,status:'REFUSE',reason:'DENIED',
    origin:'SIMULATED_LOCAL',authority:'NONE'
  })+'\n');
  process.exitCode=1;
}
