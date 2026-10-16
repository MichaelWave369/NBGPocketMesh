import { experimentE2A } from '../src/e2a-gears.mjs';
const timed=process.argv.includes('--timed');
console.log(JSON.stringify(experimentE2A({measureTime:timed}),null,2));
