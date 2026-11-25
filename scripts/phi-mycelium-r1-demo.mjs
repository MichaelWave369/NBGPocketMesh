import {compareGrowth} from '../src/phi-mycelium-r1.mjs';
for(const [name,requests] of [['ramp',[1,1,2,3,5,8,13,21,34]],['burst',Array(9).fill(34)],['intermittent',[1,1,2,3,0,0,13,0,34]]]){
  const {classification,fibonacci,linear}=compareGrowth({requests});
  console.log(JSON.stringify({name,classification,fibonacci,linear}));
}
