import {cohort} from '../src/phi-mycelium-r4.mjs';
const {classification,seeds,summary}=cohort();
console.log(JSON.stringify({classification,seeds,summary},null,2));
