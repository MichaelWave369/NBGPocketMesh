/**
 * R12 mutual-TLS anchor transport, development reference implementation.
 *
 * Unlike R11's cleartext loopback transport, this client requires TLS 1.3,
 * a trusted operator CA, exact server hostname validation + SHA-256 leaf
 * certificate pin, and a client certificate authenticated by the authority.
 * Existing R11 Ed25519 challenge/response remains mandatory.
 *
 * This code does NOT deploy a separate trust host or independent admin UID.
 * The transport client's mTLS private key is loaded into the worker process;
 * it is separate from all FOUR execution/approval/checkpoint/anchor signing
 * keys, which are NEVER loaded by the worker.
 */
import {
  createHash,createPrivateKey,createPublicKey,X509Certificate,randomBytes
} from 'node:crypto';
import {lstatSync,readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {isIP} from 'node:net';
import {checkServerIdentity} from 'node:tls';
import {request as httpsRequest,createServer as createHttpsServer} from 'node:https';
import {createReadOnlyAnchorHandler,verifyExternalAnchorProof} from './pocket-external-anchor.mjs';
import {assertSignedTrustCheckpoint} from './pocket-signed-checkpoint.mjs';

export const TLS_ANCHOR_CLIENT_SCHEMA='NBGPocketMesh.TlsAnchorClient.v1';
const KEY=/^[a-z0-9][a-z0-9._-]{0,63}$/;
const HOST=/^[a-z0-9][a-z0-9.-]{0,251}[a-z0-9]$/;
const HASH=/^[0-9a-f]{64}$/;
const MIME=/^application\/json(?:\s*;|$)/i;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function exact(value,expected,label){
  if(!plain(value)||JSON.stringify(Object.keys(value).sort())!==JSON.stringify([...expected].sort()))
    throw new TypeError(label+': unexpected or missing fields');
}
function protectedFile(path,maxBytes){
  if(typeof path!=='string'||!isAbsolute(path))
    throw new TypeError('Absolute operator-owned TLS credential path required');
  const st=lstatSync(path);
  if(!st.isFile()||st.size<30||st.size>maxBytes)
    throw new TypeError('Invalid TLS credential file or symlink');
  if(process.platform!=='win32'){
    if((st.mode&0o077)!==0||(typeof process.getuid==='function'&&st.uid!==process.getuid()))
      throw new TypeError('TLS credential file must be owner-only');
  }
  return readFileSync(path);
}
function parseEndpoint(raw){
  if(typeof raw!=='string'||raw.length>350)
    throw new TypeError('Invalid authority endpoint');
  const value=new URL(raw);
  // The operator explicitly pins this exact endpoint. No user-selectable
  // host, URL rewriting, redirect or token injection.
  if(value.protocol!=='https:'||value.username||value.password||
     value.search||value.hash||value.pathname!=='/v1/attest'||
     !value.port||value.port==='0'||!HOST.test(value.hostname)||
     value.hostname.includes('..')||value.href!==raw||
     Number(value.port)<1||Number(value.port)>65535)
    throw new TypeError('Only exact configured HTTPS authority endpoints are allowed');
  return value;
}
function validCertificate(certPem){
  const certificate=new X509Certificate(certPem);
  if(!certificate.raw||!certificate.publicKey)
    throw new TypeError('Invalid X.509 certificate');
  return certificate;
}
function keyMatchesCertificate(cert,key){
  const certKey=validCertificate(cert).publicKey.export({format:'der',type:'spki'});
  const privatePublic=createPublicKey(createPrivateKey(key)).export({format:'der',type:'spki'});
  if(!certKey.equals(privatePublic))
    throw new TypeError('mTLS certificate/private key do not match');
}
function loadClient(raw){
  exact(raw,['schema','endpoint','keyId','publicKeyPem','caFile','clientCertFile',
    'clientKeyFile','serverCertSha256','timeoutMs','maxAgeMs'],'TLS client config');
  if(raw.schema!==TLS_ANCHOR_CLIENT_SCHEMA||
     typeof raw.keyId!=='string'||!KEY.test(raw.keyId)||
     typeof raw.serverCertSha256!=='string'||!HASH.test(raw.serverCertSha256)||
     typeof raw.publicKeyPem!=='string'||raw.publicKeyPem.length>1024||
     !Number.isSafeInteger(raw.timeoutMs)||raw.timeoutMs<100||raw.timeoutMs>10000||
     !Number.isSafeInteger(raw.maxAgeMs)||raw.maxAgeMs<100||raw.maxAgeMs>15000)
    throw new TypeError('Malformed mTLS anchor client config');
  const endpoint=parseEndpoint(raw.endpoint);
  const key=createPublicKey(raw.publicKeyPem);
  if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')
    throw new TypeError('Anchor trust root must be an Ed25519 public key');
  const ca=protectedFile(raw.caFile,8192);
  const clientCert=protectedFile(raw.clientCertFile,8192);
  const clientKey=protectedFile(raw.clientKeyFile,8192);
  validCertificate(ca);validCertificate(clientCert);
  keyMatchesCertificate(clientCert,clientKey);
  return Object.freeze({endpoint:raw.endpoint,keyId:raw.keyId,key,ca,clientCert,clientKey,
    serverCertSha256:raw.serverCertSha256,timeoutMs:raw.timeoutMs,maxAgeMs:raw.maxAgeMs});
}
export function loadTlsAnchorClientConfig(configFile){
  const raw=JSON.parse(protectedFile(configFile,8192).toString('utf8'));
  return loadClient(raw);
}
/**
 * Reference HTTPS listener, explicitly bound to loopback by caller.
 * requestCert=true and rejectUnauthorized=true require a CA-signed client
 * certificate before any read-only request can reach the R11 handler.
 * Actual off-host deployment, firewall rules and OS UID segregation must be
 * implemented by an operator, not inferred from this reference API.
 */
export function createMutualTlsAnchorServer({
  directory,anchorPrivateKey,anchorKeyId,tlsServerKey,tlsServerCert,clientCa
}={}){
  if(!tlsServerKey||!tlsServerCert||!clientCa)
    throw new TypeError('Mutual TLS server credentials required');
  validCertificate(tlsServerCert);validCertificate(clientCa);
  keyMatchesCertificate(tlsServerCert,tlsServerKey);
  return createHttpsServer({
    key:tlsServerKey,cert:tlsServerCert,ca:clientCa,
    minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
    requestCert:true,rejectUnauthorized:true
  },createReadOnlyAnchorHandler({
    directory,privateKey:anchorPrivateKey,keyId:anchorKeyId
  }));
}
function httpsAttestation(client,nonce){
  return new Promise((resolve,reject)=>{
    const endpoint=new URL(client.endpoint);
    endpoint.searchParams.set('nonce',nonce);
    const options={
      method:'GET',ca:client.ca,cert:client.clientCert,key:client.clientKey,
      minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
      rejectUnauthorized:true,agent:false,
      // Hostname/IP SAN validation AND an independently pinned exact
      // certificate digest. A different CA-issued server cert is refused.
      checkServerIdentity:(host,cert)=>{
        const identityError=checkServerIdentity(host,cert);
        if(identityError)return identityError;
        const digest=createHash('sha256').update(cert.raw).digest('hex');
        if(digest!==client.serverCertSha256)
          return new Error('Pinned anchor server certificate changed');
      }
    };
    const req=httpsRequest(endpoint,options,res=>{
      if(res.statusCode!==200||!MIME.test(res.headers['content-type']||'')){
        res.resume();
        reject(new TypeError('Anchor authority denied or redirected'));
        return;
      }
      let size=0;const chunks=[];
      res.on('data',chunk=>{
        size+=chunk.byteLength;
        if(size>4096){
          req.destroy(new TypeError('Anchor response exceeds bound'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end',()=>{
        try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
        catch(e){reject(e);}
      });
      res.on('error',reject);
    });
    req.on('timeout',()=>req.destroy(new TypeError('mTLS authority timeout')));
    req.on('error',reject);
    req.setTimeout(client.timeoutMs);
    req.end();
  });
}
/** Always fetch a fresh R11 signed attestation over pinned mutual TLS.
 * On network, certificate, timeout or signature failure, execution REFUSES.
 */
export async function assertMutualTlsExternalAnchor({
  clientConfig,witnessDir,lifecyclePolicy,checkpointTrustConfig
}={}){
  if(!plain(clientConfig))throw new TypeError('Operator mTLS anchor config required');
  exact(clientConfig,['endpoint','keyId','key','ca','clientCert','clientKey',
    'serverCertSha256','timeoutMs','maxAgeMs'],'host mTLS config');
  // Ensure no execution can skip local signed checkpoint and latest witness.
  const local=assertSignedTrustCheckpoint({
    witnessDir,lifecyclePolicy,trustConfig:checkpointTrustConfig
  });
  const nonce=randomBytes(16).toString('hex');
  const proof=await httpsAttestation(clientConfig,nonce);
  return verifyExternalAnchorProof({proof,nonce,local,clientConfig});
}
