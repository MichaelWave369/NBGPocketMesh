import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {
  mkdtempSync,mkdirSync,writeFileSync,rmSync,readdirSync,
  chmodSync,symlinkSync
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createDemoLibrary} from '../src/pocket-library.mjs';
import {prepareExecutionRequest,signExecutionRequest} from '../src/pocket-signed-gate.mjs';
import {
  CONFIG_SCHEMA,REQUEST_SCHEMA,RESPONSE_SCHEMA,MAX_REQUEST_BYTES,
  loadExecutorConfig
} from '../src/pocket-executor-protocol.mjs';

const worker=fileURLToPath(new URL('../scripts/pocket-executor-worker.mjs',import.meta.url));
function fixture({allowedProfiles=['observe','triage','health']}={}){
  const folder=mkdtempSync(join(tmpdir(),'pocket-executor-test-'));
  const ledgerDir=join(folder,'ledger');
  mkdirSync(ledgerDir,{mode:0o700});
  const pair=generateKeyPairSync('ed25519');
  const configFile=join(folder,'config.json');
  writeFileSync(configFile,JSON.stringify({
    schema:CONFIG_SCHEMA,ledgerDir,
    trustedKeys:{'operator-test':pair.publicKey.export({format:'pem',type:'spki'})},
    allowedProfiles
  }),{mode:0o600,flag:'wx'});
  return {folder,ledgerDir,configFile,pair,cleanup:()=>rmSync(folder,{force:true,recursive:true})};
}
async function permitFor(f,{profile='health',mode='selective',issuedAtMs,expiresAtMs}={}){
  const request=await prepareExecutionRequest({
    library:createDemoLibrary(),profile,mode,
    ...(issuedAtMs===undefined?{}:{issuedAtMs}),
    ...(expiresAtMs===undefined?{}:{expiresAtMs})
  });
  return signExecutionRequest(request,{keyId:'operator-test',privateKey:f.pair.privateKey});
}
function run(configFile,payload){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[worker,configFile],{
      stdio:['pipe','pipe','pipe'],
      env:{...process.env,NODE_OPTIONS:''}
    });
    let stdout='',stderr='';
    child.stdout.on('data',buf=>stdout+=buf.toString('utf8'));
    child.stderr.on('data',buf=>stderr+=buf.toString('utf8'));
    child.on('error',reject);
    child.on('close',code=>{
      try {
        const lines=stdout.trim().split('\n');
        assert.equal(lines.length,1,'service must emit exactly one JSON response');
        resolve({code,body:JSON.parse(lines[0]),stderr});
      }catch(err){reject(err);}
    });
    child.stdin.on('error',()=>{}); // expected if oversize input is rejected early
    child.stdin.end(typeof payload==='string'?payload:JSON.stringify(payload));
  });
}
async function isolated(fn,options){
  const f=fixture(options);
  try {await fn(f);}
  finally {f.cleanup();}
}
test('valid signed permit performs one trusted local album in a fresh child process',async()=>{
  await isolated(async f=>{
    const permit=await permitFor(f);
    const {code,body,stderr}=await run(f.configFile,{schema:REQUEST_SCHEMA,permit});
    assert.equal(code,0);
    assert.equal(stderr,'');
    assert.equal(body.schema,RESPONSE_SCHEMA);
    assert.equal(body.status,'PERFORM');
    assert.match(body.receipt.outputSha256,/^[a-f0-9]{64}$/);
    assert.equal(readdirSync(f.ledgerDir).length,1);
    assert.equal(Object.hasOwn(body,'output'),false);
    assert.doesNotMatch(JSON.stringify(body),/switch-fixture-01|eth1|Inspect down interfaces/);
  });
});
test('cross-process replay is refused by persistent nonce ledger',async()=>{
  await isolated(async f=>{
    const envelope={schema:REQUEST_SCHEMA,permit:await permitFor(f)};
    const a=await run(f.configFile,envelope);
    const b=await run(f.configFile,envelope);
    assert.equal(a.body.status,'PERFORM');
    assert.equal(b.body.status,'REFUSE');
    assert.notEqual(b.code,0);
    assert.equal(readdirSync(f.ledgerDir).length,1);
  });
});
test('two independent child processes cannot spend one nonce twice',async()=>{
  await isolated(async f=>{
    const envelope={schema:REQUEST_SCHEMA,permit:await permitFor(f)};
    const [a,b]=await Promise.all([run(f.configFile,envelope),run(f.configFile,envelope)]);
    assert.deepEqual([a.body.status,b.body.status].sort(),['PERFORM','REFUSE']);
    assert.equal(readdirSync(f.ledgerDir).length,1);
  });
});
test('missing, unsigned and legacy boolean requests never reach album execution',async()=>{
  await isolated(async f=>{
    for(const payload of [
      {schema:REQUEST_SCHEMA},
      {schema:REQUEST_SCHEMA,operatorApproved:true,boundaryOpen:true},
      {schema:REQUEST_SCHEMA,permit:{operatorApproved:true,boundaryOpen:true}},
      {schema:'unknown',permit:{}},
    ]){
      const r=await run(f.configFile,payload);
      assert.equal(r.body.status,'REFUSE');
      assert.notEqual(r.code,0);
    }
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('client cannot supply its own public trust root or ledger path',async()=>{
  await isolated(async f=>{
    const permit=await permitFor(f);
    const r=await run(f.configFile,{
      schema:REQUEST_SCHEMA,permit,
      trustedKeys:{attacker:'fake'},
      ledgerDir:'/tmp/attacker',
      operatorApproved:true
    });
    assert.equal(r.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('altered signature, changed signed profile and unknown signer fail closed',async()=>{
  await isolated(async f=>{
    const permit=await permitFor(f);
    const bad=[
      {...permit,signature:'A'.repeat(86)},
      {...permit,request:{...permit.request,profile:'observe'}},
      {...permit,keyId:'unknown-signer'}
    ];
    for(const value of bad){
      const r=await run(f.configFile,{schema:REQUEST_SCHEMA,permit:value});
      assert.equal(r.body.status,'REFUSE');
    }
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('operator profile policy blocks a correctly signed but disallowed album',async()=>{
  await isolated(async f=>{
    const permit=await permitFor(f);
    const r=await run(f.configFile,{schema:REQUEST_SCHEMA,permit});
    assert.equal(r.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  },{allowedProfiles:['observe']});
});
test('expired permits are refused using the child process clock',async()=>{
  await isolated(async f=>{
    const now=Date.now();
    const permit=await permitFor(f,{issuedAtMs:now-30000,expiresAtMs:now-20000});
    const r=await run(f.configFile,{schema:REQUEST_SCHEMA,permit});
    assert.equal(r.body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('config files cannot be read from symlinks or permissive local modes',async()=>{
  await isolated(async f=>{
    const permit=await permitFor(f);
    const envelope={schema:REQUEST_SCHEMA,permit};
    chmodSync(f.configFile,0o644);
    assert.equal((await run(f.configFile,envelope)).body.status,'REFUSE');
    chmodSync(f.configFile,0o600);
    const symlinkPath=join(f.folder,'config-link.json');
    symlinkSync(f.configFile,symlinkPath);
    assert.equal((await run(symlinkPath,envelope)).body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('operator replay ledger must exist with restricted permissions',async()=>{
  await isolated(async f=>{
    const envelope={schema:REQUEST_SCHEMA,permit:await permitFor(f)};
    chmodSync(f.ledgerDir,0o755);
    assert.equal((await run(f.configFile,envelope)).body.status,'REFUSE');
    chmodSync(f.ledgerDir,0o700);
    assert.equal((await run(f.configFile,envelope)).body.status,'PERFORM');
  });
});
test('oversized and malformed stdin are refused, never evaluated',async()=>{
  await isolated(async f=>{
    const huge='x'.repeat(MAX_REQUEST_BYTES+3000);
    assert.equal((await run(f.configFile,huge)).body.status,'REFUSE');
    assert.equal((await run(f.configFile,'{not-json')).body.status,'REFUSE');
    assert.equal(readdirSync(f.ledgerDir).length,0);
  });
});
test('different allowed profiles each retain their original typed stage count',async()=>{
  await isolated(async f=>{
    for(const [profile,count] of [['observe',1],['triage',2],['health',3]]){
      const permit=await permitFor(f,{profile});
      const r=await run(f.configFile,{schema:REQUEST_SCHEMA,permit});
      assert.equal(r.body.status,'PERFORM');
      assert.equal(readdirSync(f.ledgerDir).length,['observe','triage','health'].indexOf(profile)+1);
      assert.match(r.body.receipt.receiptSha256,/^[a-f0-9]{64}$/);
    }
  });
});
test('configured public keys are validated and never include a private signer',async()=>{
  await isolated(async f=>{
    const config=loadExecutorConfig(f.configFile);
    assert.deepEqual(config.allowedProfiles,['observe','triage','health']);
    assert.equal(config.trustedKeys['operator-test'].type,'public');
    assert.equal(Object.hasOwn(config,'privateKey'),false);
  });
});
