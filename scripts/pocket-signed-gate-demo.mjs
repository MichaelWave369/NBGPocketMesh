/**
 * Offline signed execution gate demo. An ephemeral Ed25519 key pair is
 * generated in memory. The signer must be a separately controlled identity
 * provider in any real deployment; nothing here proves a human identity.
 */
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {
  prepareExecutionRequest,signExecutionRequest,executeSignedPermit
} from '../src/pocket-signed-gate.mjs';

const keys=generateKeyPairSync('ed25519');
const trustedKeys={'demo-operator':keys.publicKey};
const library=createDemoLibrary();
const ledgerDir=mkdtempSync(join(tmpdir(),'pocket-signed-gate-'));
try {
  const request=await prepareExecutionRequest({library,profile:'health'});
  const permit=signExecutionRequest(request,{
    keyId:'demo-operator',privateKey:keys.privateKey
  });
  const result=await executeSignedPermit({
    library,profile:'health',permit,trustedKeys,ledgerDir
  });
  let replayDenied=false;
  try {
    await executeSignedPermit({library,profile:'health',permit,trustedKeys,ledgerDir});
  }catch(error){
    replayDenied=/nonce already spent/.test(String(error.message));
  }
  if(result.receipt.decision!=='PERFORM'||!replayDenied)
    throw new Error('Signed-gate demo did not enforce execution and replay refusal');
  console.log(JSON.stringify({
    schema:'NBGPocketMesh.SignedExecutionGateDemo.v1',
    origin:'SIMULATED_LOCAL',authority:'NONE',
    caveat:'Ephemeral demo key and trusted local modules only; no human identity verification, production authorization, sandbox, secure deployment or persistence beyond this demo.',
    request:{profile:request.profile,albumId:request.albumId,
      revision:request.albumRevision,mode:request.mode,expiresAtMs:request.expiresAtMs},
    execution:{decision:result.receipt.decision,
      signerFingerprintSha256:result.receipt.signerFingerprintSha256,
      receiptSha256:result.receipt.receiptSha256,
      outputSha256:result.receipt.outputSha256,
      syntheticReport:result.output},
    replay:{denied:replayDenied,ledgerEntries:readdirSync(ledgerDir).length}
  },null,2));
}finally {
  // Ephemeral demonstration only. A real long-lived operator-owned replay
  // ledger must NEVER be automatically removed or reset after execution.
  rmSync(ledgerDir,{recursive:true,force:true});
}
