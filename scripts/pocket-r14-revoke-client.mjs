#!/usr/bin/env node
/**
 * Operator-only R14 lab helper to revoke a single permitted client certificate.
 * This CLI is never exposed through HTTPS or the one-shot executor.
 * It is a demo of policy-file rotation, not a production policy-authority API
 * or a protection against an administrator restoring an older policy file.
 */
import {openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {loadAnchorClientAccessPolicy} from '../src/pocket-anchor-client-access.mjs';

const [filePath,certFingerprint,revisionText]=process.argv.slice(2);
if(process.argv.length!==5||
   process.env.POCKET_ANCHOR_CLIENT_ADMIN_CONFIRM!=='1'||
   !/^[a-f0-9]{64}$/.test(certFingerprint||'')||
   !/^[1-9][0-9]*$/.test(revisionText||''))
  throw new TypeError('Explicit operator consent, fingerprint and expected revision required');
const current=loadAnchorClientAccessPolicy(filePath);
if(current.policyRevision!==Number(revisionText)||
   current.policyRevision>=1_000_000)
  throw new TypeError('Client access policy revision changed');
const row=current.clients.find(x=>x.certSha256===certFingerprint);
if(!row||row.state!=='active')
  throw new TypeError('Target client is not currently authorized');
const next={...current,policyRevision:current.policyRevision+1,
  clients:current.clients.map(x=>x.certSha256===certFingerprint?
    {...x,state:'revoked'}:x)};
const temp=join(dirname(filePath),'.access-'+randomBytes(12).toString('hex')+'.tmp');
let created=false;
try{
  const fd=openSync(temp,'wx',0o600);
  created=true;
  try{
    writeFileSync(fd,JSON.stringify(next)+'\n','utf8');
    fsyncSync(fd);
  }finally{closeSync(fd);}
  renameSync(temp,filePath);
  if(process.platform!=='win32'){
    const d=openSync(dirname(filePath),'r');
    try{fsyncSync(d);}finally{closeSync(d);}
  }
  console.log(JSON.stringify({status:'REVOKED',policyRevision:next.policyRevision}));
}catch(err){
  if(created){try{unlinkSync(temp);}catch{}}
  throw err;
}
