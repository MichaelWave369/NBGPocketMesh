import {cohort} from '../src/phi-mycelium-r7.mjs';
const {classification,seeds,summary}=cohort();
console.log(JSON.stringify({classification,seeds,summary},null,2));
