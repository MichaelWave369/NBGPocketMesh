#!/usr/bin/env node
/**
 * R13 one-shot executor with R12 authenticated TLS + pinned authority,
 * R13 client-certificate access and local retained signed-epoch high-water.
 *
 * The operator provides SEVEN paths; the caller may supply only the exact
 * signed permit and signed PhiID approval envelope over bounded stdin.
 */
import {loadExecutorConfig} from '../src/pocket-executor-protocol.mjs';
import {AUTHORIZED_RECEIPT_SCHEMA,loadPhiIDApprovalPolicy} from '../src/pocket-phiid-approval.mjs';
import {loadTrustLifecyclePolicy,executeTrustLifecycleRequest} from '../src/pocket-trust-lifecycle.mjs';
import {loadCheckpointTrustConfig} from '../src/pocket-signed-checkpoint.mjs';
import {loadTlsAnchorClientConfig,assertMutualTlsExternalAnchor} from '../src/pocket-mtls-anchor.mjs';
import {inspectAnchorContinuity} from '../src/pocket-anchor-continuity.mjs';

async function readRequest(){
  const chunks=[];let count=0;
  for await(const chunk of process.stdin){
    count+=chunk.length;
    if(count>16384)throw new TypeError('Input too large');
    chunks.push(chunk);
  }
  if(!count)throw new TypeError('Missing signed envelope');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
try{
  if(process.argv.length!==9)
    throw new TypeError('Seven host-provided paths required');
  const executorConfig=loadExecutorConfig(process.argv[2]);
  const approvalPolicy=loadPhiIDApprovalPolicy(process.argv[3]);
  const lifecyclePolicy=loadTrustLifecyclePolicy(process.argv[4]);
  const witnessDir=process.argv[5];
  const checkpointTrustConfig=loadCheckpointTrustConfig(process.argv[6]);
  const tlsClient=loadTlsAnchorClientConfig(process.argv[7]);
  const continuityDir=process.argv[8];
  // Fail before reading the input if continuity history is absent, corrupt,
  // symlinked or too permissive. No auto-create or reset by execution worker.
  inspectAnchorContinuity(continuityDir);
  const spki=k=>k.export({format:'der',type:'spki'}).toString('hex');
  const roots=[...Object.values(executorConfig.trustedKeys),
    ...Object.values(approvalPolicy.trustedApprovers)];
  if(roots.some(k=>spki(k)===spki(tlsClient.key))||
     roots.some(k=>spki(k)===spki(checkpointTrustConfig.key))||
     spki(tlsClient.key)===spki(checkpointTrustConfig.key))
    throw new TypeError('Independent application signer keys required');
  const envelope=await readRequest();
  const result=await executeTrustLifecycleRequest(envelope,{
    executorConfig,approvalPolicy,lifecyclePolicy,
    policyWitnessCheck:()=>assertMutualTlsExternalAnchor({
      clientConfig:tlsClient,witnessDir,lifecyclePolicy,
      checkpointTrustConfig,continuityDir
    })
  });
  process.stdout.write(JSON.stringify(result)+'\n');
}catch{
  process.stdout.write(JSON.stringify({
    schema:AUTHORIZED_RECEIPT_SCHEMA,authority:'NONE',
    origin:'SIMULATED_LOCAL',status:'REFUSE',reason:'DENIED'
  })+'\n');
  process.exitCode=1;
}
