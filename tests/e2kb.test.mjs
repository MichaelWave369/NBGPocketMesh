import test from 'node:test';
import assert from 'node:assert/strict';
import {DATA,FAMILIES,SCHEMA,train,infer,fixed,evaluate,selectMargin,benchmark} from '../site/src/blind-keyhole.js';
test('frozen disjoint balanced text partitions',()=>{
 assert.deepEqual([DATA.train.length,DATA.validation.length,DATA.holdout.length],[60,20,40]);
 const rows=[...DATA.train,...DATA.validation,...DATA.holdout];
 assert.equal(new Set(rows.map(r=>r.id)).size,120);
 assert.equal(new Set(rows.map(r=>r.text)).size,120);
 for(const f of FAMILIES)assert.equal(DATA.holdout.filter(r=>r.gold===f).length,8);
});
test('learned inference only accepts a text string and bounded margin',()=>{
 const m=train(),row=DATA.holdout[0];
 assert.deepEqual(infer(m,row.text,6),infer(m,row.text,6));
 for(const v of ['',{},null,'x', 'x'.repeat(401)])assert.throws(()=>infer(m,v,6),TypeError);
 assert.throws(()=>infer(m,row.text,-1),RangeError);
});
test('calibration chooses margin using validation without inspecting holdout',()=>{
 const m=train(),gate=selectMargin(m);
 assert.ok([0,0.5,1.5,3,6,12,24].includes(gate.margin));
 assert.throws(()=>evaluate(m,'train',gate.margin),TypeError);
 const r=evaluate(m,'holdout',gate.margin);
 for(const stats of Object.values(r.results))assert.equal(stats.correct+stats.wrong+stats.abstainedKnown,stats.total);
});
test('baseline comparison and abstentions are not concealed',()=>{
 const b=benchmark();
 assert.equal(b.schema,SCHEMA);assert.equal(b.origin,'SIMULATED');assert.equal(b.authority,'NONE');
 assert.equal(b.trace.length,40);assert.equal(b.comparison.alwaysAbstain.correct,8);
 assert.ok(b.comparison.learned.abstainedKnown>0);
 assert.ok(b.comparison.learned.correct>=b.comparison.fixed.correct);
});
test('fixed rules refuse out-of-domain and conflicting clues',()=>{
 assert.equal(fixed('Please write a lovely invitation to the museum gala.').family,'ABSTAIN');
 assert.equal(fixed('Rotate a vector then calculate the monument height ratio.').family,'ABSTAIN');
});
test('identical run produces identical train/validation/holdout receipts',()=>{
 assert.deepEqual(benchmark(),benchmark());
});
