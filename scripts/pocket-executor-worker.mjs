#!/usr/bin/env node
/**
 * ONE-SHOT stdin-only local executor.
 * Run under a protected OS account; never expose the historical unsigned
 * research APIs as service endpoints. No private key is loaded here.
 */
import {
  REQUEST_SCHEMA,RESPONSE_SCHEMA,MAX_REQUEST_BYTES,
  loadExecutorConfig,executeExecutorRequest
} from '../src/pocket-executor-protocol.mjs';

async function readBoundedInput(){
  const chunks=[];let total=0;
  for await (const chunk of process.stdin){
    total+=chunk.length;
    if(total>MAX_REQUEST_BYTES)
      throw new TypeError('Request exceeds size limit');
    chunks.push(chunk);
  }
  if(!total)throw new TypeError('Empty request');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function main(){
  if(process.argv.length!==3)throw new TypeError('Expected one operator config path');
  const config=loadExecutorConfig(process.argv[2]);
  const envelope=await readBoundedInput();
  const response=await executeExecutorRequest(envelope,config);
  process.stdout.write(JSON.stringify(response)+'\n');
}
try{
  await main();
}catch{
  // Avoid exposing local file names, key metadata, or internal stack traces.
  process.stdout.write(JSON.stringify({
    schema:RESPONSE_SCHEMA,status:'REFUSE',authority:'NONE',
    origin:'SIMULATED_LOCAL',reason:'DENIED'
  })+'\n');
  process.exitCode=1;
}
