/**
 * TEST/DEMO-ONLY ephemeral X.509 certificate fixture generator.
 * Requires an installed openssl CLI (GitHub Actions Ubuntu runner has it).
 * No private keys/certificates are committed. Caller deletes its temp dir.
 */
import {execFileSync} from 'node:child_process';
import {
  mkdirSync,writeFileSync,chmodSync,readFileSync
} from 'node:fs';
import {join} from 'node:path';
import {createHash,X509Certificate} from 'node:crypto';

export function createEphemeralTlsFixture(root,{remoteIPv4=null}={}){
  const dir=join(root,'tls');
  mkdirSync(dir,{mode:0o700});
  const run=(...args)=>execFileSync('openssl',args,{
    cwd:dir,stdio:['ignore','pipe','pipe'],timeout:120000
  });
  function ca(label){
    run('req','-x509','-newkey','rsa:2048','-nodes',
      '-keyout',label+'.key','-out',label+'.crt','-days','2',
      '-subj','/CN=PocketMeshR12-'+label,
      '-addext','basicConstraints=critical,CA:TRUE',
      '-addext','keyUsage=critical,keyCertSign,cRLSign');
  }
  function certificate(name,issuer,extensions){
    run('req','-new','-newkey','rsa:2048','-nodes',
      '-keyout',name+'.key','-out',name+'.csr','-subj','/CN='+name);
    writeFileSync(join(dir,name+'.ext'),extensions);
    run('x509','-req','-in',name+'.csr','-CA',issuer+'.crt',
      '-CAkey',issuer+'.key','-CAcreateserial','-out',name+'.crt',
      '-days','2','-extfile',name+'.ext');
  }
  ca('trusted');
  certificate('server','trusted',
    'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n');
  if(remoteIPv4){
    if(!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(remoteIPv4)||
       remoteIPv4.split('.').some(v=>Number(v)>255))
      throw new TypeError('Invalid test authority IPv4 address');
    certificate('server-remote','trusted',
      `subjectAltName=IP:${remoteIPv4}\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n`);
  }
  certificate('client','trusted',
    'extendedKeyUsage=clientAuth\nkeyUsage=digitalSignature,keyEncipherment\n');
  certificate('client-other','trusted',
    'extendedKeyUsage=clientAuth\\nkeyUsage=digitalSignature,keyEncipherment\\n'.replaceAll('\\n','\n'));
  ca('rogue');
  certificate('rogue-client','rogue',
    'extendedKeyUsage=clientAuth\nkeyUsage=digitalSignature,keyEncipherment\n');
  const paths={};
  for(const name of ['trusted.crt','trusted.key','server.crt','server.key',
    ...(remoteIPv4?['server-remote.crt','server-remote.key']:[]),
    'client.crt','client.key','client-other.crt','client-other.key','rogue.crt','rogue.key','rogue-client.crt','rogue-client.key']){
    paths[name.replace(/[-.]/g,'_')]=join(dir,name);
    chmodSync(join(dir,name),0o600);
  }
  const serverCert=new X509Certificate(readFileSync(paths.server_crt));
  const remoteCert=remoteIPv4?new X509Certificate(readFileSync(paths.server_remote_crt)):null;
  return {
    ...paths,
    ...(remoteCert?{remoteServerCertSha256:createHash('sha256').update(remoteCert.raw).digest('hex')}:{}),
    serverCertSha256:createHash('sha256').update(serverCert.raw).digest('hex')
  };
}
