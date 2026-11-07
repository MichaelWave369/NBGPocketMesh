#!/usr/bin/env node
/**
 * OPERATOR-ONLY local witness command. Run with a separate privileged
 * operator account, never from a web request or execution-worker process.
 * No private signing keys are accepted or read.
 */
import {
  initializePolicyWitness,advancePolicyWitness,inspectPolicyWitness,
  loadWitnessedLifecyclePolicy
} from '../src/pocket-policy-witness.mjs';

const [action,dir,policyFile]=process.argv.slice(2);
if(!['init','advance','inspect'].includes(action)||!dir||
   ((action==='inspect')!==(!policyFile))){
  console.error('Usage: pocket-witness-admin.mjs init|advance <witnessDir> <policy.json> OR inspect <witnessDir>');
  process.exitCode=2;
}else if(action==='inspect'){
  const result=inspectPolicyWitness(dir);
  console.log(JSON.stringify({epoch:result.epoch,witnessSha256:result.witnessSha256}));
}else{
  if(process.env.POCKET_WITNESS_ADMIN_CONFIRM!=='1')
    throw new TypeError('Explicit operator-only admin confirmation required');
  const policy=loadWitnessedLifecyclePolicy(policyFile);
  const record=action==='init'
    ?initializePolicyWitness(dir,policy)
    :advancePolicyWitness(dir,policy);
  console.log(JSON.stringify({epoch:record.epoch,witnessSha256:record.witnessSha256}));
}
