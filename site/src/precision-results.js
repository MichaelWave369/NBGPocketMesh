// Frozen observed results from docs/E2PC_PROTOCOL.md (synthetic numerical run).
// This browser module displays the receipt values; it does not execute the E2PC trained model.
export const PRECISION_RESULTS = Object.freeze([
 {id:'f32',name:'Always FP32',correct:384,total:384,escalations:0,mismatch:0,bytes:42.666667,note:'Reference: selected eight-weight bundles stored as Float32.'},
 {id:'int8',name:'Always INT8',correct:384,total:384,escalations:0,mismatch:0,bytes:16,note:'Uniform quantization at 8-bit; no changes versus FP32 on this holdout.'},
 {id:'int4',name:'Always INT4',correct:381,total:384,escalations:0,mismatch:3,bytes:10.666667,note:'Lowest selected payload bytes, but three changed reference decisions.'},
 {id:'bound',name:'Bounded refinement',correct:384,total:384,escalations:6,mismatch:0,bytes:10.916667,note:'4-bit first, escalation only if a conservative error bound cannot certify the reference sign.'},
 {id:'conflict',name:'Opposing-sign gate',correct:383,total:384,escalations:68,mismatch:1,bytes:14.916667,note:'Two opposing specialist contributions are a weak conflict proxy, not a logical contradiction.'},
 {id:'hybrid',name:'Hybrid gate',correct:384,total:384,escalations:72,mismatch:0,bytes:15.041667,note:'Both conflict and uncertainty triggers; more escalation without better outcomes than bound-only.'}
]);
export function precisionResult(id){return PRECISION_RESULTS.find(r=>r.id===id)||null;}
