import test from 'node:test';
import assert from 'node:assert/strict';
import {PRECISION_RESULTS,precisionResult} from '../src/precision-results.js';
test('precision report has the six recorded comparison policies',()=>{
 assert.deepEqual(PRECISION_RESULTS.map(x=>x.id),['f32','int8','int4','bound','conflict','hybrid']);
 assert.ok(PRECISION_RESULTS.every(x=>x.total===384&&x.bytes>0));
});
test('uncertainty refinement does not claim conflict advantages',()=>{
 assert.equal(precisionResult('int4').correct,381);
 assert.equal(precisionResult('bound').correct,384);
 assert.equal(precisionResult('bound').escalations,6);
 assert.equal(precisionResult('conflict').correct,383);
 assert.equal(precisionResult('conflict').escalations,68);
 assert.equal(precisionResult('hybrid').escalations,72);
 assert.equal(precisionResult('f32').correct,precisionResult('int8').correct);
});
