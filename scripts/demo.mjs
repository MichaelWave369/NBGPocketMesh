import { route } from '../src/router.mjs';
import { TASK, MANIFESTS } from '../src/fixtures.mjs';
console.log(JSON.stringify(route(TASK, MANIFESTS), null, 2));
