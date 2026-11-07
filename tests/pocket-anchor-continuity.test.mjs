import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,
  readdirSync,chmodSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
  ANCHOR_CONTINUITY_SCHEMA,inspectAnchorContinuity,acceptAnchorContinuity
} from '../src/pocket-anchor-continuity.mjs';
import {CLIENT_ACCESS_SCHEMA,loadAnchorClientAccessPolicy,
  requireAllowedAnchorClient} from '../src/pocket-anchor-client-access.mjs';
import {validateAnchorBind} from '../src/pocket-anchor-deployment.mjs';

const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64);
async function fixture(fn){
  const root=mkdtempSync(join(tmpdir(),'pocket-r13-'));
  const dir=join(root,'continuity');
  mkdirSync(dir,{mode:0o700});
  const policyFile=join(root,'client-policy.json');
  const policy={schema:CLIENT_ACCESS_SCHEMA,policyRevision:1,
    clients:[{certSha256:A,state:'active'},{certSha256:B,state:'revoked'}]};
  const write=()=>writeFileSync(policyFile,JSON.stringify(policy),{mode:0o600});
  write();
  try{await fn({root,dir,policyFile,policy,write});}
  finally{rmSync(root,{force:true,recursive:true});}
}
function accept(dir,epoch=1,witnessSha256=A,anchorAttestationSha256=B){
  return acceptAnchorContinuity(dir,{epoch,witnessSha256,anchorAttestationSha256});
}
test('empty continuity directory is a trusted new lab and first signed epoch is recorded',async()=>{
  await fixture(({dir})=>{
    assert.deepEqual(inspectAnchorContinuity(dir),{
      epoch:0,witnessSha256:null,recordSha256:null,records:0
    });
    const r=accept(dir);
    assert.equal(r.advanced,true);
    assert.equal(r.epoch,1);
    assert.equal(inspectAnchorContinuity(dir).epoch,1);
    assert.equal(readdirSync(dir).length,1);
    assert.equal(JSON.parse(readFileSync(join(dir,'epoch-000001.json'),'utf8')).schema,
      ANCHOR_CONTINUITY_SCHEMA);
  });
});
test('repeated fresh attestations of the same epoch and witness do not mutate high-water',async()=>{
  await fixture(({dir})=>{
    const a=accept(dir,1,A,B),b=accept(dir,1,A,C);
    assert.equal(a.recordSha256,b.recordSha256);
    assert.equal(b.advanced,false);
    assert.equal(readdirSync(dir).length,1);
  });
});
test('higher signed epoch advances continuity, then a lower epoch is refused',async()=>{
  await fixture(({dir})=>{
    accept(dir,1,A,B);
    accept(dir,2,B,C);
    const tip=inspectAnchorContinuity(dir);
    assert.equal(tip.epoch,2);
    assert.equal(tip.records,2);
    assert.equal(tip.witnessSha256,B);
    assert.throws(()=>accept(dir,1,A,B),/decreased/);
  });
});
test('same epoch with a different witness is refused as equivocation',async()=>{
  await fixture(({dir})=>{
    accept(dir,7,A,B);
    assert.throws(()=>accept(dir,7,C,B),/equivocated/);
  });
});
test('signed authority may advance multiple epochs while executor is offline',async()=>{
  await fixture(({dir})=>{
    accept(dir,1,A,B);accept(dir,5,C,B);
    assert.equal(inspectAnchorContinuity(dir).epoch,5);
    assert.deepEqual(readdirSync(dir).sort(),[
      'epoch-000001.json','epoch-000005.json'
    ]);
  });
});
test('corrupted, missing, symlinked and unexpected continuity history refuses',async()=>{
  await fixture(({root,dir})=>{
    accept(dir,1,A,B);accept(dir,2,B,C);
    const first=join(dir,'epoch-000001.json');
    const old=JSON.parse(readFileSync(first,'utf8'));
    writeFileSync(first,JSON.stringify({...old,epoch:99}));
    assert.throws(()=>inspectAnchorContinuity(dir),/hash mismatch|history broken|Invalid continuity/);
    writeFileSync(first,JSON.stringify(old));
    const extra=join(dir,'not-an-epoch.json');
    writeFileSync(extra,'{}',{mode:0o600});
    assert.throws(()=>inspectAnchorContinuity(dir),/Unexpected/);
    rmSync(extra);
    const alias=join(root,'alias');
    symlinkSync(dir,alias);
    assert.throws(()=>inspectAnchorContinuity(alias),/symbolic-linked/);
    assert.equal(inspectAnchorContinuity(dir).epoch,2);
  });
});
test('continuity protection refuses broad filesystem permissions',async()=>{
  await fixture(({dir})=>{
    chmodSync(dir,0o755);
    assert.throws(()=>inspectAnchorContinuity(dir),/mode invalid/);
    chmodSync(dir,0o700);
    accept(dir);
    const file=join(dir,'epoch-000001.json');
    chmodSync(file,0o644);
    assert.throws(()=>inspectAnchorContinuity(dir),/mode invalid/);
  });
});
test('client access policy requires unique exact fingerprints and explicit active state',async()=>{
  await fixture(({policyFile,policy,write})=>{
    assert.equal(loadAnchorClientAccessPolicy(policyFile).clients.length,2);
    policy.clients[1].certSha256=A;write();
    assert.throws(()=>loadAnchorClientAccessPolicy(policyFile),/duplicate/);
    policy.clients[1].certSha256=B;
    policy.clients[0].state='disabled';write();
    assert.throws(()=>loadAnchorClientAccessPolicy(policyFile),/Invalid/);
  });
});
test('client policy revocation is re-read for each attestation',async()=>{
  await fixture(({policyFile,policy,write})=>{
    const raw=Buffer.alloc(256,17);
    const real=createHash('sha256').update(raw).digest('hex');
    policy.clients=[{certSha256:real,state:'active'}];write();
    const req={socket:{authorized:true,getPeerCertificate:()=>({raw})}};
    assert.equal(requireAllowedAnchorClient(req,policyFile).policyRevision,1);
    policy.clients[0].state='revoked';policy.policyRevision=2;write();
    assert.throws(()=>requireAllowedAnchorClient(req,policyFile),/not approved/);
    req.socket.authorized=false;
    assert.throws(()=>requireAllowedAnchorClient(req,policyFile),/mutual TLS/);
  });
});
test('operator client policy path rejects symlinks and group-readable files',async()=>{
  await fixture(({root,policyFile})=>{
    chmodSync(policyFile,0o644);
    assert.throws(()=>loadAnchorClientAccessPolicy(policyFile),/permissions/);
    chmodSync(policyFile,0o600);
    const alias=join(root,'policy-link.json');
    symlinkSync(policyFile,alias);
    assert.throws(()=>loadAnchorClientAccessPolicy(alias),/symlinked/);
  });
});
test('private network listener demands operator approval and rejects public/wildcard bind',()=>{
  assert.deepEqual(validateAnchorBind('127.0.0.1',0),{
    host:'127.0.0.1',port:0,remote:false
  });
  for(const ip of ['0.0.0.0','8.8.8.8','169.254.1.1',
    '::','localhost','127.000.0.1','172.32.0.1','192.169.0.1'])
    assert.throws(()=>validateAnchorBind(ip,8788,{remoteApproved:true}));
  for(const ip of ['10.1.2.3','172.31.200.1','192.168.1.12']){
    assert.throws(()=>validateAnchorBind(ip,8788),/explicit approval/);
    assert.throws(()=>validateAnchorBind(ip,0,{remoteApproved:true}),/fixed port/);
    assert.equal(validateAnchorBind(ip,8788,{remoteApproved:true}).remote,true);
  }
});
