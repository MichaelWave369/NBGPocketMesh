#!/usr/bin/env node
/**
 * R11: one-shot local worker requiring:
 * - signed one-use Pocket permit
 * - independently signed PhiID action approval
 * - R8 key lifecycle / audit, R9 witness, R10 signed checkpoint
 * - R11 fresh nonce-bound attestation from independent reference authority
 *
 * Host supplies SIX trusted startup paths; stdin carries only the permit
 * envelope. Private signing keys are never loaded by this process.
 */
import {loadExecutorConfig} from '../src/pocket-executor-protocol.mjs';
import {
  AUTHORIZED_RECEIPT_SCHEMA,loadPhiIDApprovalPolicy
} from '../src/pocket-phiid-approval.mjs';
import {loadTrustLifecyclePolicy,executeTrustLifecycleRequest} from '../src/pocket-trust-lifecycle.mjs';
import {loadCheckpointTrustConfig} from '../src/pocket-signed-checkpoint.mjs';
import {
  loadExternalAnchorClientConfig,assertExternalAnchor
} from '../src/pocket-external-anchor.mjs';
async function request(){
  let size=0;const chunks=[];
  for await(const chunk of process.stdin){
    size+=chunk.byteLength;
    if(size>16384)throw new TypeError('Oversized signed envelope');
    chunks.push(chunk);
  }
  if(!size)throw new TypeError('Empty signed envelope');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
try{
  if(process.argv.length!==8)throw new TypeError('Six operator config paths required');
  const executorConfig=loadExecutorConfig(process.argv[2]);
  const approvalPolicy=loadPhiIDApprovalPolicy(process.argv[3]);
  const lifecyclePolicy=loadTrustLifecyclePolicy(process.argv[4]);
  const witnessDir=process.argv[5];
  const checkpointTrustConfig=loadCheckpointTrustConfig(process.argv[6]);
  const anchorClient=loadExternalAnchorClientConfig(process.argv[7]);

  // Enforce a fourth independent Ed25519 key for anchor attestations.
  const fingerprint=k=>k.export({format:'der',type:'spki'}).toString('hex');
  const anchorKey=fingerprint(anchorClient.key);
  const others=[
    checkpointTrustConfig.key,...Object.values(executorConfig.trustedKeys),
    ...Object.values(approvalPolicy.trustedApprovers)
  ];
  if(others.some(k=>fingerprint(k)===anchorKey))
    throw new TypeError('Anchor key must be separate from checkpoint, permit and approval');
  const checkpointKey=fingerprint(checkpointTrustConfig.key);
  if(others.slice(1).some(k=>fingerprint(k)===checkpointKey))
    throw new TypeError('Checkpoint key must remain separate from permit and approval');

  const envelope=await request();
  const result=await executeTrustLifecycleRequest(envelope,{
    executorConfig,approvalPolicy,lifecyclePolicy,
    policyWitnessCheck:()=>assertExternalAnchor({
      clientConfig:anchorClient,witnessDir,lifecyclePolicy,checkpointTrustConfig
    })
  });
  process.stdout.write(JSON.stringify(result)+'\n');
}catch{
  process.stdout.write(JSON.stringify({
    schema:AUTHORIZED_RECEIPT_SCHEMA,status:'REFUSE',reason:'DENIED',
    origin:'SIMULATED_LOCAL',authority:'NONE'
  })+'\n');
  process.exitCode=1;
}
