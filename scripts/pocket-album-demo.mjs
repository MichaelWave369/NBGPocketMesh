import {performance} from 'node:perf_hooks';
import {createPocketAlbum,runPocketAlbum,verifyPocketAlbumReceipt} from '../src/pocket-album.mjs';
const album=createPocketAlbum();
const comparisons=[];
for (const target of ['observe','diagnose','report']) {
  const cases={};
  for(const mode of ['selective','eager']) {
    const start=performance.now();
    const {output,receipt}=await runPocketAlbum({album,target,mode});
    cases[mode]={
      decision:receipt.decision,
      requestedModules:receipt.requestedModules,
      declaredWorkingSetMiB:receipt.declaredWorkingSetMiB,
      wallTimeMsIllustrative:Number((performance.now()-start).toFixed(3)),
      outputSha256:receipt.outputSha256,
      replayVerified:await verifyPocketAlbumReceipt(receipt,{album,target,mode}),
      receiptSha256:receipt.receiptSha256,
      ...(target==='report'?{result:output}:{})
    };
  }
  comparisons.push({target,outputEquivalent:cases.selective.outputSha256===cases.eager.outputSha256,cases});
}
console.log(JSON.stringify({schema:'NBGPocketMesh.PocketAlbumDemo.v0',origin:'SIMULATED_LOCAL',authority:'NONE',
  provenance:'Locally constructed fixture and file digests; no externally authenticated source',
  caveat:'Import requests and declared MiB are not measured peak RAM or VRAM. Wall times are one-shot, cache-sensitive illustrations, not speedup evidence.',
  albumSha256:album.albumSha256,comparisons},null,2));
