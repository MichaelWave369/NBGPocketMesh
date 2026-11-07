#!/usr/bin/env node
/**
 * R12 loopback-only mutual TLS anchor authority. No write/mutation routes.
 * The R11 operator CLI retains init/advance/inspect functions offline.
 */
import {lstatSync,readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createPrivateKey} from 'node:crypto';
import {createMutualTlsAnchorServer} from '../src/pocket-mtls-anchor.mjs';

const [dir,anchorKeyFile,anchorKeyId,tlsKeyFile,tlsCertFile,clientCaFile,portText='0']=process.argv.slice(2);
if(process.argv.length<8||process.argv.length>9||
   !/^(?:0|[1-9][0-9]{0,4})$/.test(portText)||
   Number(portText)>65535)
  throw new TypeError('Usage: pocket-mtls-anchor-authority.mjs <authorityDir> <ed25519KeyFile> <keyId> <tlsServerKeyFile> <tlsServerCertFile> <clientCaFile> [port]');
function protectedFile(path){
  if(typeof path!=='string'||!isAbsolute(path))throw new TypeError('Absolute operator-only path required');
  const st=lstatSync(path);
  if(!st.isFile()||st.size<30||st.size>8192)
    throw new TypeError('Unsafe key/certificate path');
  if(process.platform!=='win32'){
    if((st.mode&0o077)!==0||
       (typeof process.getuid==='function'&&st.uid!==process.getuid()))
      throw new TypeError('Unprotected authority certificate/key');
  }
  return readFileSync(path);
}
const server=createMutualTlsAnchorServer({
  directory:dir,
  anchorPrivateKey:createPrivateKey(protectedFile(anchorKeyFile)),
  anchorKeyId,
  tlsServerKey:protectedFile(tlsKeyFile),
  tlsServerCert:protectedFile(tlsCertFile),
  clientCa:protectedFile(clientCaFile)
});
server.listen(Number(portText),'127.0.0.1',()=>{
  console.log(JSON.stringify({
    status:'LISTENING',host:'127.0.0.1',port:server.address().port,
    transport:'TLSv1.3/mTLS',authority:'LOCAL_REFERENCE_ONLY'
  }));
});
