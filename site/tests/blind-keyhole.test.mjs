import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmark,train,infer,DATA} from '../src/blind-keyhole.js';
test('browser uses the same text-only learner as Node',()=>{
 const b=benchmark(),m=train();
 assert.equal(b.trace.length,40);
 assert.equal(b.trace[0].learned,infer(m,DATA.holdout[0].text,b.validationSelectedMargin).family);
});
