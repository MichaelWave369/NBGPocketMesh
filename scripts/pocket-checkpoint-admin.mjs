#!/usr/bin/env node
/**
 * Operator-only, explicit offline checkpoint signing.
 * No private keys are loaded by the executor worker or web UI.
 */
import {readFileSync} from 'node:fs';
import {createPrivateKey,createPublicKey} from 'node:crypto';
import {loadWitnessedLifecyclePolicy} from '../src/pocket-policy-witness.mjs';
import {
  issueTrustCheckpoint,publishTrustCheckpoint,loadCheckpointTrustConfig
} from '../src/pocket-signed-checkpoint.mjs';
import {lstatSync} from 'node:fs';
import {isAbsolute} from 'node:path';

const [action,policyFile,witnessDir,trustConfigFile,privateKeyFile]=process.argv.slice(2);
if(action!=='issue'||!policyFile||!witnessDir||!trustConfigFile||!privateKeyFile||
   process.argv.length!==7){
  console.error('Usage: node scripts/pocket-checkpoint-admin.mjs issue <lifecycle.json> <witnessDir> <checkpoint-config.json> <private-key.pem>');
  process.exitCode=2;
}else{
  if(process.env.POCKET_CHECKPOINT_OPERATOR_CONFIRM!=='1')
    throw new TypeError('Explicit operator checkpoint issuance confirmation required');
  if(!isAbsolute(privateKeyFile))throw new TypeError('Absolute private key path required');
  const st=lstatSync(privateKeyFile);
  if(!st.isFile()||st.size<32||st.size>4096)
    throw new TypeError('Invalid checkpoint signer key path');
  if(process.platform!=='win32'){
    if((st.mode&0o077)!==0||
       (typeof process.getuid==='function'&&st.uid!==process.getuid()))
      throw new TypeError('Unprotected signer private key file');
  }
  const config=loadCheckpointTrustConfig(trustConfigFile);
  const privateKey=createPrivateKey(readFileSync(privateKeyFile));
  const derived=createPublicKey(privateKey);
  if(derived.export({type:'spki',format:'der'}).compare(
    config.key.export({type:'spki',format:'der'}))!==0)
    throw new TypeError('Operator signer does not match configured public trust root');
  const policy=loadWitnessedLifecyclePolicy(policyFile);
  const checkpoint=issueTrustCheckpoint({
    witnessDir,lifecyclePolicy:policy,privateKey,keyId:config.keyId,
    ttlMs:Math.min(config.maxAgeMs,10*60*1000)
  });
  const digest=publishTrustCheckpoint(config.checkpointFile,checkpoint);
  console.log(JSON.stringify({policyEpoch:checkpoint.statement.policyEpoch,checkpointSha256:digest}));
}
