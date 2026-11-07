import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {
  mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,
  readdirSync,chmodSync,symlinkSync
} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {request as httpsRequest,createServer as createHttpsServer} from 'node:https';
import {fileURLToPath} from 'node:url';
import {createEphemeralTlsFixture} from '../scripts/dev-mtls-fixture.mjs';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {CONFIG_SCHEMA} from '../src/pocket-executor-protocol.mjs';
import {
  APPROVAL_POLICY_SCHEMA,AUTHORIZED_REQUEST_SCHEMA,signPhiIDApproval
} from '../src/pocket-phiid-approval.mjs';
import {TRUST_POLICY_SCHEMA,verifyTrustAuditDirectory} from '../src/pocket-trust-lifecycle.mjs';
import {
  initializePolicyWitness,advancePolicyWitness,inspectPolicyWitness
} from '../src/pocket-policy-witness.mjs';
import {
  CHECKPOINT_CONFIG_SCHEMA,issueTrustCheckpoint,publishTrustCheckpoint
} from '../src/pocket-signed-checkpoint.mjs';
import {
  initializeExternalAnchor,advanceExternalAnchor,inspectAnchor
} from '../src/pocket-external-anchor.mjs';
import {
  TLS_ANCHOR_CLIENT_SCHEMA,createMutualTlsAnchorServer,
  loadTlsAnchorClientConfig
} from '../src/pocket-mtls-anchor.mjs';

const WORKER=fileURLToPath(new URL('../scripts/pocket-mtls-anchor-worker.mjs',import.meta.url));
const ADMIN=fileURLToPath(new URL('../scripts/pocket-anchor-authority.mjs',import.meta.url));
const library=createDemoLibrary();
const tlsRoot=mkdtempSync(join(tmpdir(),'pocket-r12-tls-'));
const TLS=createEphemeralTlsFixture(tlsRoot);
after(()=>rmSync(tlsRoot,{force:true,recursive:true}));
const subject={iss:'http://127.0.0.1:8080/realms/phiid-dev',sub:'r12-fixture-user'};
const pem=x=>x.publicKey.export({format:'pem',type:'spki'});
const fingerprint=x=>createHash('sha256').update(
  x.publicKey.export({format:'der',type:'spki'})).digest('hex');
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'pocket-r12-anchor-'));
  const paths={
    ledger:join(root,'ledger'),audit:join(root,'audit'),
    witness:join(root,'witness'),external:join(root,'external-anchor'),
    executor:join(root,'executor.json'),approval:join(root,'approval.json'),
    policy:join(root,'lifecycle.json'),cpConfig:join(root,'checkpoint-config.json'),
    anchorConfig:join(root,'anchor-client.json'),checkpoint1:join(root,'checkpoint-1.json'),
    checkpoint2:join(root,'checkpoint-2.json'),anchorPrivate:join(root,'anchor-private.pem')
  };
  for(const p of [paths.ledger,paths.audit,paths.witness,paths.external])
    mkdirSync(p,{mode:0o700});
  const keys={
    permit:generateKeyPairSync('ed25519'),approval:generateKeyPairSync('ed25519'),
    checkpoint:generateKeyPairSync('ed25519'),anchor:generateKeyPairSync('ed25519')
  };
  const write=(p,v)=>writeFileSync(p,JSON.stringify(v),{mode:0o600});
  write(paths.executor,{
    schema:CONFIG_SCHEMA,ledgerDir:paths.ledger,allowedProfiles:['health'],
    trustedKeys:{'permit-a':pem(keys.permit)}
  });
  write(paths.approval,{
    schema:APPROVAL_POLICY_SCHEMA,policyEpoch:1,allowedSubjects:[subject],
    revokedApprovalIds:[],trustedApprovers:{'approval-a':pem(keys.approval)}
  });
  const policy={
    schema:TRUST_POLICY_SCHEMA,policyEpoch:1,auditDir:paths.audit,
    permitSigners:{'permit-a':{fingerprintSha256:fingerprint(keys.permit),state:'active'}},
    approvalSigners:{'approval-a':{fingerprintSha256:fingerprint(keys.approval),state:'active'}}
  };
  const cpConfig={
    schema:CHECKPOINT_CONFIG_SCHEMA,keyId:'checkpoint-op',
    publicKeyPem:pem(keys.checkpoint),checkpointFile:paths.checkpoint1,maxAgeMs:600000
  };
  write(paths.policy,policy);write(paths.cpConfig,cpConfig);
  writeFileSync(paths.anchorPrivate,keys.anchor.privateKey.export({type:'pkcs8',format:'pem'}),
    {mode:0o600,flag:'wx'});
  initializePolicyWitness(paths.witness,policy);
  initializeExternalAnchor(paths.external,inspectPolicyWitness(paths.witness).witnessSha256);
  const signed=issueTrustCheckpoint({
    witnessDir:paths.witness,lifecyclePolicy:policy,
    privateKey:keys.checkpoint.privateKey,keyId:'checkpoint-op',ttlMs:300000
  });
  publishTrustCheckpoint(paths.checkpoint1,signed);
  let server=null;
  async function start(){
    if(server)throw new Error('Already started');
    server=createMutualTlsAnchorServer({
      directory:paths.external,anchorPrivateKey:keys.anchor.privateKey,anchorKeyId:'anchor-a',
      tlsServerKey:readFileSync(TLS.server_key),
      tlsServerCert:readFileSync(TLS.server_crt),
      clientCa:readFileSync(TLS.trusted_crt)
    });
    await new Promise((resolve,reject)=>{
      server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
    });
    write(paths.anchorConfig,{
      schema:TLS_ANCHOR_CLIENT_SCHEMA,
      endpoint:'https://127.0.0.1:'+server.address().port+'/v1/attest',
      keyId:'anchor-a',publicKeyPem:pem(keys.anchor),timeoutMs:2500,maxAgeMs:5000,
      caFile:TLS.trusted_crt,clientCertFile:TLS.client_crt,clientKeyFile:TLS.client_key,
      serverCertSha256:TLS.serverCertSha256
    });
  }
  const stop=()=>new Promise(resolve=>server?server.close(()=>{server=null;resolve();}):resolve());
  function promote(){
    policy.policyEpoch=2;policy.permitSigners['permit-a'].state='revoked';
    policy.approvalSigners['approval-a'].state='revoked';
    write(paths.policy,policy);
    const w=advancePolicyWitness(paths.witness,policy);
    cpConfig.checkpointFile=paths.checkpoint2;
    write(paths.cpConfig,cpConfig);
    publishTrustCheckpoint(paths.checkpoint2,issueTrustCheckpoint({
      witnessDir:paths.witness,lifecyclePolicy:policy,
      privateKey:keys.checkpoint.privateKey,keyId:'checkpoint-op',ttlMs:300000
    }));
    advanceExternalAnchor(paths.external,2,w.witnessSha256);
  }
  return {root,paths,keys,write,policy,cpConfig,start,stop,promote,
    cleanup:()=>rmSync(root,{force:true,recursive:true})};
}
async function envelope(f){
  const request=await prepareExecutionRequest({library,profile:'health'});
  const permit=signExecutionRequest(request,{
    keyId:'permit-a',privateKey:f.keys.permit.privateKey
  });
  const approval=signPhiIDApproval({
    permit,subject,privateKey:f.keys.approval.privateKey,authorityKeyId:'approval-a'
  });
  return {schema:AUTHORIZED_REQUEST_SCHEMA,permit,approval};
}
function execute(f,value){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[
      WORKER,f.paths.executor,f.paths.approval,f.paths.policy,
      f.paths.witness,f.paths.cpConfig,f.paths.anchorConfig
    ],{stdio:['pipe','pipe','pipe'],env:{...process.env,NODE_OPTIONS:''}});
    let stdout='',stderr='';
    child.stdout.on('data',b=>stdout+=b);
    child.stderr.on('data',b=>stderr+=b);
    child.on('error',reject);
    child.on('close',code=>{
      try{
        const lines=stdout.trim().split('\n');
        assert.equal(lines.length,1);
        resolve({code,body:JSON.parse(lines[0]),stderr});
      }catch(e){reject(e);}
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(value));
  });
}
async function isolated(action){
  const f=fixture();
  try{await action(f);}
  finally{await f.stop();f.cleanup();}
}

test('real TLS 1.3 client certificate and pinned server allow one one-shot synthetic album',async()=>{
  await isolated(async f=>{
    await f.start();
    const result=await execute(f,await envelope(f));
    assert.equal(result.code,0);
    assert.equal(result.body.status,'PERFORM');
    assert.equal(result.stderr,'');
    assert.equal(readdirSync(f.paths.ledger).length,1);
    assert.match(result.body.audit.finalSha256,/^[0-9a-f]{64}$/);
    assert.deepEqual(verifyTrustAuditDirectory(f.paths.audit),{
      attempts:1,performed:1,refused:0,orphaned:0
    });
    assert.doesNotMatch(JSON.stringify(result.body),/r12-fixture-user|switch-fixture|eth1/);
  });
});
test('full rollback of R8/R9/R10 local trust still fails against independent TLS authority epoch two',async()=>{
  await isolated(async f=>{
    await f.start();
    const oldPolicy=structuredClone(f.policy),oldCheckpointConfig=structuredClone(f.cpConfig);
    f.promote();
    f.write(f.paths.policy,oldPolicy);
    f.write(f.paths.cpConfig,oldCheckpointConfig);
    rmSync(join(f.paths.witness,'epoch-000002.json'));
    assert.equal(inspectPolicyWitness(f.paths.witness).epoch,1);
    assert.equal(inspectAnchor(f.paths.external).epoch,2);
    const denied=await execute(f,await envelope(f));
    assert.equal(denied.body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
    assert.equal(verifyTrustAuditDirectory(f.paths.audit).refused,1);
  });
});
test('lost TLS authority fails closed; no cached signed-response fallback exists',async()=>{
  await isolated(async f=>{
    await f.start();
    await f.stop();
    const denied=await execute(f,await envelope(f));
    assert.equal(denied.body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
    assert.equal(verifyTrustAuditDirectory(f.paths.audit).refused,1);
  });
});
test('mismatched pinned server SHA-256 refuses before nonce consumption',async()=>{
  await isolated(async f=>{
    await f.start();
    const cfg=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    cfg.serverCertSha256='f'.repeat(64);
    f.write(f.paths.anchorConfig,cfg);
    const denied=await execute(f,await envelope(f));
    assert.equal(denied.body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('untrusted server CA refuses despite a matching pinned server digest',async()=>{
  await isolated(async f=>{
    await f.start();
    const cfg=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    f.write(f.paths.anchorConfig,{...cfg,caFile:TLS.rogue_crt});
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('TLS client certificate from an untrusted CA cannot access anchor',async()=>{
  await isolated(async f=>{
    await f.start();
    const cfg=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    f.write(f.paths.anchorConfig,{
      ...cfg,clientCertFile:TLS.rogue_client_crt,clientKeyFile:TLS.rogue_client_key
    });
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('TLS authority refuses requests without a client certificate at handshake',async()=>{
  await isolated(async f=>{
    await f.start();
    const url=new URL(JSON.parse(readFileSync(f.paths.anchorConfig,'utf8')).endpoint);
    url.searchParams.set('nonce','a'.repeat(32));
    const outcome=await new Promise(resolve=>{
      const req=httpsRequest(url,{
        ca:readFileSync(TLS.trusted_crt),minVersion:'TLSv1.3',
        rejectUnauthorized:true,agent:false
      },res=>{res.resume();resolve({status:res.statusCode});});
      req.on('error',()=>resolve({error:true}));
      req.end();
    });
    assert.equal(outcome.error,true,'unauthenticated client must not get an HTTP response');
  });
});
test('mismatched TLS client private key and certificate fail config loading',async()=>{
  await isolated(async f=>{
    await f.start();
    const cfg=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    f.write(f.paths.anchorConfig,{...cfg,clientKeyFile:TLS.server_key});
    assert.throws(()=>loadTlsAnchorClientConfig(f.paths.anchorConfig),/do not match/);
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
  });
});
test('untrusted anchor Ed25519 signer is refused even over valid mutual TLS',async()=>{
  await isolated(async f=>{
    await f.start();
    const cfg=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    const other=generateKeyPairSync('ed25519');
    f.write(f.paths.anchorConfig,{...cfg,publicKeyPem:pem(other)});
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
  });
});
test('HTTP downgrade, redirect tricks and URL injection are forbidden by config',async()=>{
  await isolated(async f=>{
    await f.start();
    const raw=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    const port=new URL(raw.endpoint).port;
    for(const endpoint of [
      'http://127.0.0.1:'+port+'/v1/attest',
      'https://127.0.0.1:'+port+'/v1/attest?nonce=x',
      'https://user:pass@127.0.0.1:'+port+'/v1/attest',
      'https://127.0.0.1:'+port+'/admin',
      'https://127.0.0.1:'+port+'/v1/attest#x'
    ]){
      f.write(f.paths.anchorConfig,{...raw,endpoint});
      assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
    }
    assert.equal(readdirSync(f.paths.ledger).length,0);
  });
});
test('server hostname/SAN must match configured endpoint, even with trusted CA',async()=>{
  await isolated(async f=>{
    await f.start();
    const raw=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    const altered='https://localhost:'+new URL(raw.endpoint).port+'/v1/attest';
    f.write(f.paths.anchorConfig,{...raw,endpoint:altered});
    assert.equal((await execute(f,await envelope(f))).body.status,'REFUSE');
  });
});
test('server redirects must not follow to an alternate endpoint',async()=>{
  await isolated(async f=>{
    await f.start();
    const raw=JSON.parse(readFileSync(f.paths.anchorConfig,'utf8'));
    const server=createHttpsServer({
      key:readFileSync(TLS.server_key),cert:readFileSync(TLS.server_crt),
      ca:readFileSync(TLS.trusted_crt),requestCert:true,rejectUnauthorized:true,
      minVersion:'TLSv1.3',maxVersion:'TLSv1.3'
    },(_req,res)=>{res.writeHead(302,{Location:raw.endpoint});res.end();});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      f.write(f.paths.anchorConfig,{
        ...raw,endpoint:'https://127.0.0.1:'+server.address().port+'/v1/attest'
      });
      const denied=await execute(f,await envelope(f));
      assert.equal(denied.body.status,'REFUSE');
      assert.equal(readdirSync(f.paths.ledger).length,0);
    }finally{await new Promise(resolve=>server.close(resolve));}
  });
});
test('two concurrent authorized TLS workers still spend only one nonce',async()=>{
  await isolated(async f=>{
    await f.start();
    const request=await envelope(f);
    const [a,b]=await Promise.all([execute(f,request),execute(f,request)]);
    assert.deepEqual([a.body.status,b.body.status].sort(),['PERFORM','REFUSE']);
    assert.equal(readdirSync(f.paths.ledger).length,1);
    assert.deepEqual(verifyTrustAuditDirectory(f.paths.audit),{
      attempts:2,performed:1,refused:1,orphaned:0
    });
  });
});
test('operator can promote authority but local/remote split-brain blocks execution',async()=>{
  await isolated(async f=>{
    await f.start();
    f.promote();
    const denied=await execute(f,await envelope(f));
    assert.equal(denied.body.status,'REFUSE'); // old signer revoked in R8
    assert.equal(readdirSync(f.paths.ledger).length,0);
    assert.equal(inspectAnchor(f.paths.external).epoch,2);
  });
});
test('strict owner permissions required for client TLS key, CA and config files',async()=>{
  await isolated(async f=>{
    await f.start();
    chmodSync(f.paths.anchorConfig,0o644);
    assert.throws(()=>loadTlsAnchorClientConfig(f.paths.anchorConfig),/owner-only/);
    chmodSync(f.paths.anchorConfig,0o600);
    const alias=join(f.root,'client-link.json');
    symlinkSync(f.paths.anchorConfig,alias);
    assert.throws(()=>loadTlsAnchorClientConfig(alias),/symlink/);
  });
});
