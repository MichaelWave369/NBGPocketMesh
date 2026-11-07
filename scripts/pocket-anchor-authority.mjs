#!/usr/bin/env node
/**
 * R11 independent anchor reference authority, LOOPBACK ONLY.
 * No remotely accessible admin endpoints. The executor never receives the
 * authority private key or the authority's persistent directory path.
 */
import {lstatSync,readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createPrivateKey} from 'node:crypto';
import {
  createLocalAnchorServer,initializeExternalAnchor,
  advanceExternalAnchor,inspectAnchor
} from '../src/pocket-external-anchor.mjs';
const [action,...args]=process.argv.slice(2);
if(action==='serve'){
  const [dir,keyFile,keyId,portText='0']=args;
  if(args.length<3||args.length>4||!isAbsolute(keyFile)||
     !/^(?:0|[1-9][0-9]{0,4})$/.test(portText)||
     Number(portText)>65535)throw new TypeError('Invalid authority startup arguments');
  const stat=lstatSync(keyFile);
  if(!stat.isFile()||stat.size<30||stat.size>4096)
    throw new TypeError('Unsafe authority signing key');
  if(process.platform!=='win32'){
    if((stat.mode&0o077)!==0||
       (typeof process.getuid==='function'&&stat.uid!==process.getuid()))
      throw new TypeError('Authority key must be owner protected');
  }
  const server=createLocalAnchorServer({
    directory:dir,keyId,privateKey:createPrivateKey(readFileSync(keyFile))
  });
  server.listen(Number(portText),'127.0.0.1',()=>{
    const address=server.address();
    process.stdout.write(JSON.stringify({
      ready:true,address:'127.0.0.1',port:address.port
    })+'\n');
  });
}else if(action==='init'||action==='advance'){
  if(process.env.POCKET_ANCHOR_ADMIN_CONFIRM!=='1')
    throw new TypeError('Operator-only anchor promotion requires explicit confirmation');
  const [dir,epochText,witnessSha256]=args;
  if(args.length!==3||!(/^[1-9][0-9]*$/).test(epochText))
    throw new TypeError('Invalid anchor admin arguments');
  const epoch=Number(epochText);
  const result=action==='init'
    ?(epoch===1?initializeExternalAnchor(dir,witnessSha256):
       (()=>{throw new TypeError('Anchor initialization starts at epoch one');})())
    :advanceExternalAnchor(dir,epoch,witnessSha256);
  process.stdout.write(JSON.stringify({epoch:result.epoch,recordSha256:result.recordSha256})+'\n');
}else if(action==='inspect'){
  if(args.length!==1)throw new TypeError('Anchor inspect requires state directory');
  process.stdout.write(JSON.stringify(inspectAnchor(args[0]))+'\n');
}else{
  console.error('Usage: serve <anchorDir> <privateKeyPemFile> <keyId> [port] | init|advance <anchorDir> <epoch> <witnessSha256> | inspect <anchorDir>');
  process.exitCode=2;
}
