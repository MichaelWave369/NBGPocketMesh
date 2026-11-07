#!/usr/bin/env node
/**
 * R12 one-shot synthetic execution worker.
 * Six operator-controlled paths and stdin permit only.
 * TLS client private credential resides in this process, distinct from all
 * Ed25519 signing keys (permit, PhiID approval, checkpoint, authority).
 */
import {loadExecutorConfig} from '../src/pocket-executor-protocol.mjs';
import {
  AUTHORIZED_RECEIPT_SCHEMA,loadPhiIDApprovalPolicy
} from '../src/pocket-phiid-approval.mjs';
import {loadTrustLifecyclePolicy,executeTrustLifecycleRequest} from '../src/pocket-trust-lifecycle.mjs';
import {loadCheckpointTrustConfig} from '../src/pocket-signed-checkpoint.mjs';
import {
  loadTlsAnchorClientConfig,assertMutualTlsExternalAnchor
} from '../src/pocket-mtls-anchor.mjs';

async function request(){
  const chunks=[];let count=0;
  for await(const chunk of process.stdin){
    count+=chunk.byteLength;
    if(count>16384)throw new TypeError('Oversized client envelope');
    chunks.push(chunk);
  }
  if(!count)throw new TypeError('No signed client envelope');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
try{
  if(process.argv.length!==8)throw new TypeError('Six operator paths required');
  const executorConfig=loadExecutorConfig(process.argv[2]);
  const approvalPolicy=loadPhiIDApprovalPolicy(process.argv[3]);
  const lifecyclePolicy=loadTrustLifecyclePolicy(process.argv[4]);
  const witnessDir=process.argv[5];
  const checkpointTrustConfig=loadCheckpointTrustConfig(process.argv[6]);
  const tlsClient=loadTlsAnchorClientConfig(process.argv[7]);

  const spki=x=>x.export({format:'der',type:'spki'}).toString('hex');
  const otherRoots=[
    checkpointTrustConfig.key,...Object.values(executorConfig.trustedKeys),
    ...Object.values(approvalPolicy.trustedApprovers)
  ];
  if(otherRoots.some(k=>spki(k)===spki(tlsClient.key)))
    throw new TypeError('Anchor Ed25519 signing key must be independent');
  if(otherRoots.slice(1).some(k=>spki(k)===spki(checkpointTrustConfig.key)))
    throw new TypeError('Checkpoint signing key must remain independent');
  const envelope=await request();
  const result=await executeTrustLifecycleRequest(envelope,{
    executorConfig,approvalPolicy,lifecyclePolicy,
    policyWitnessCheck:()=>assertMutualTlsExternalAnchor({
      clientConfig:tlsClient,witnessDir,lifecyclePolicy,checkpointTrustConfig
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
