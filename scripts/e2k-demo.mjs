import { createHash } from 'node:crypto';
import { KEYHOLE_CASES, PRECISION_INPUTS, experiment } from '../site/src/pattern-keyhole.js';

const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const result = experiment();
const unsigned = {...result, fixtureSha256:hash(KEYHOLE_CASES), precisionFixtureSha256:hash(PRECISION_INPUTS)};
console.log(JSON.stringify({...unsigned,receiptSha256:hash(unsigned)},null,2));
