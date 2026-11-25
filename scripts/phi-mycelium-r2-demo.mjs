import {germination,descriptor,reconstruct,overlay} from '../src/phi-mycelium-r2.mjs';
const {pockets,...summary}=germination();
const d=descriptor('r.3.6'),r=reconstruct(d),edited=overlay(d,[{index:0,value:(r.cells[0]+1)%97}]);
console.log(JSON.stringify({...summary,pocketCount:pockets.length,example:{descriptor:d,baseChecksum:r.checksum,edits:edited.edits,editedChecksum:edited.checksum}},null,2));
