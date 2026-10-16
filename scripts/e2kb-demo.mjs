import {createHash} from 'node:crypto';
import {benchmark,DATA} from '../site/src/blind-keyhole.js';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const result=benchmark(),unsigned={...result,
 trainSha256:digest(DATA.train),validationSha256:digest(DATA.validation),holdoutSha256:digest(DATA.holdout)};
console.log(JSON.stringify({...unsigned,receiptSha256:digest(unsigned)},null,2));
