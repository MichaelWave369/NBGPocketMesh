#!/usr/bin/env node
/**
 * R13 private-network authority deployment entrypoint. No admin endpoints.
 * The authority state, Ed25519 key, TLS credentials and client allowlist are
 * host-owned files. The operator, not the client, chooses the listen address.
 */
import {lstatSync,readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createPrivateKey} from 'node:crypto';
import {createMutualTlsAnchorServer} from '../src/pocket-mtls-anchor.mjs';
import {validateAnchorBind} from '../src/pocket-anchor-deployment.mjs';

const args=process.argv.slice(2);
if(args.length!==9)
  throw new TypeError('Usage: node scripts/pocket-remote-anchor-authority.mjs <epochDir> <anchorEd25519Key> <keyId> <serverTlsKey> <serverTlsCert> <clientCaCert> <clientAccessPolicy> <bindIPv4> <port>');
const [directory,anchorKeyFile,anchorKeyId,serverKeyFile,serverCertFile,
  clientCaFile,clientAccessPolicyFile,host,portString]=args;
if(!/^(0|[1-9][0-9]{0,4})$/.test(portString))
  throw new TypeError('Invalid authority TCP port');
const bind=validateAnchorBind(host,Number(portString),{
  remoteApproved:process.env.POCKET_ANCHOR_PRIVATE_BIND_APPROVED==='1'
});
function protectedFile(path){
  if(typeof path!=='string'||!isAbsolute(path))
    throw new TypeError('Expected absolute operator-controlled key path');
  const st=lstatSync(path);
  if(!st.isFile()||st.size<30||st.size>8192)
    throw new TypeError('Unprotected or symlinked credential file');
  if(process.platform!=='win32'&&
     ((st.mode&0o077)!==0||
       (typeof process.getuid==='function'&&st.uid!==process.getuid())))
    throw new TypeError('Credential file ownership/mode not restricted');
  return readFileSync(path);
}
const server=createMutualTlsAnchorServer({
  directory,
  anchorPrivateKey:createPrivateKey(protectedFile(anchorKeyFile)),
  anchorKeyId,
  tlsServerKey:protectedFile(serverKeyFile),
  tlsServerCert:protectedFile(serverCertFile),
  clientCa:protectedFile(clientCaFile),
  clientAccessPolicyFile
});
server.listen(bind.port,bind.host,()=>{
  process.stdout.write(JSON.stringify({
    status:'LISTENING',
    host:bind.host,port:server.address().port,
    transport:'TLS1.3/mTLS+Ed25519',
    clientLeafAllowlist:true,
    remoteBind:bind.remote,
    authority:'OPERATOR_REFERENCE_NO_ADMIN_ENDPOINT'
  })+'\n');
});
