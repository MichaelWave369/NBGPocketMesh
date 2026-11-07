/**
 * R13 authority client access: a CA-signed TLS client is NOT automatically
 * trusted to request signed anchor attestations. The independently maintained
 * authority also pins each permitted X.509 leaf DER SHA-256 fingerprint.
 *
 * This is host-local protected-file access policy, not production PKI,
 * distributed certificate revocation, HSM custody or audit-proof storage.
 */
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';

export const CLIENT_ACCESS_SCHEMA='NBGPocketMesh.AnchorClientAccessPolicy.v1';
const HASH=/^[a-f0-9]{64}$/;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function exact(v,fields,reason){
  if(!plain(v)||JSON.stringify(Object.keys(v).sort())!==JSON.stringify([...fields].sort()))
    throw new TypeError(reason+': unexpected or missing fields');
}
export function loadAnchorClientAccessPolicy(path){
  if(typeof path!=='string'||!isAbsolute(path))
    throw new TypeError('Operator-owned absolute client access policy path required');
  const stat=lstatSync(path);
  if(!stat.isFile()||stat.size<25||stat.size>8192)
    throw new TypeError('Client access policy missing, invalid or symlinked');
  if(process.platform!=='win32'&&
      ((stat.mode&0o077)!==0||(typeof process.getuid==='function'&&stat.uid!==process.getuid())))
    throw new TypeError('Client access policy permissions or ownership invalid');
  const data=JSON.parse(readFileSync(path,'utf8'));
  exact(data,['schema','policyRevision','clients'],'client access policy');
  if(data.schema!==CLIENT_ACCESS_SCHEMA||!Number.isSafeInteger(data.policyRevision)||
     data.policyRevision<1||data.policyRevision>1_000_000||
     !Array.isArray(data.clients)||data.clients.length<1||data.clients.length>32)
    throw new TypeError('Invalid client access policy');
  const seen=new Set();
  for(const client of data.clients){
    exact(client,['certSha256','state'],'client policy rule');
    if(!HASH.test(client.certSha256)||!['active','revoked'].includes(client.state)||
       seen.has(client.certSha256))
      throw new TypeError('Invalid, duplicate or revoked client rule');
    seen.add(client.certSha256);
  }
  return data;
}
export function tlsPeerCertificateSha256(req){
  if(req.socket?.authorized!==true||typeof req.socket?.getPeerCertificate!=='function')
    throw new TypeError('Client did not pass mutual TLS');
  const peer=req.socket.getPeerCertificate(true);
  if(!Buffer.isBuffer(peer?.raw)||peer.raw.length<50)
    throw new TypeError('Client leaf certificate missing');
  return createHash('sha256').update(peer.raw).digest('hex');
}
export function requireAllowedAnchorClient(req,policyFile){
  // Re-read the operator-only file for EVERY attestation so revocation
  // applies to new requests without restarting the authority service.
  const policy=loadAnchorClientAccessPolicy(policyFile);
  const digest=tlsPeerCertificateSha256(req);
  if(!policy.clients.some(c=>c.certSha256===digest&&c.state==='active'))
    throw new TypeError('Client certificate not approved by independent authority');
  return {policyRevision:policy.policyRevision,certSha256:digest};
}
