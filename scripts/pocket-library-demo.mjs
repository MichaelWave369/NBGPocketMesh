/**
 * Pocket Album v1 demo. No network, model downloads, live device probes, or
 * background processes. Optional --save FILE creates a new immutable snapshot.
 * Optional --load FILE reads an operator-supplied local snapshot.
 */
import {
  createDemoLibrary,searchPocketLibrary,resolveAlbum,runLibraryAlbum,
  verifyLibraryReceipt,savePocketLibrary,loadPocketLibrary
} from '../src/pocket-library.mjs';

const args=process.argv.slice(2);
const usage='Usage: npm run demo:library -- [--save path | --load path]';
if(args.length>2||(args.length&&(!['--save','--load'].includes(args[0])||typeof args[1]!=='string'||!args[1]))) {
  console.error(usage);
  process.exitCode=2;
}else{
  const library=args[0]==='--load'?loadPocketLibrary(args[1]):createDemoLibrary();
  if(args[0]==='--save')savePocketLibrary(args[1],library);
  const options={library,id:'network-health'};
  const current=resolveAlbum(library,{id:'network-health'});
  if(!current)throw new TypeError('Loaded snapshot has no network-health album');
  const performance=await runLibraryAlbum(options);
  const historical=await runLibraryAlbum({...options,revision:1});
  const observer=await runLibraryAlbum({library,id:'network-observe',mode:'selective'});
  const eager=await runLibraryAlbum({library,id:'network-observe',mode:'eager'});
  console.log(JSON.stringify({
    schema:'NBGPocketMesh.PocketLibraryDemo.v1',
    origin:'SIMULATED_LOCAL',authority:'NONE',
    caveat:'Content hashes and replay test local integrity only; declared working sets are synthetic and not measured memory savings.',
    librarySha256:library.librarySha256,
    pocketCount:new Set(library.albums.map(a=>a.pocket)).size,
    albumRevisions:library.albums.length,distinctTrackDigests:library.tracks.length,
    found:searchPocketLibrary(library,{tag:'network'}).map(a=>({
      id:a.id,pocket:a.pocket,revision:a.revision,tracks:a.trackRefs.length
    })),
    networkHealth:{
      revision:current.revision,
      result:performance.output,
      replayVerified:await verifyLibraryReceipt(performance.receipt,options),
      matchesHistoricalOutput:performance.receipt.v0Receipt.outputSha256===historical.receipt.v0Receipt.outputSha256,
      implementationChanged:performance.receipt.albumSha256!==historical.receipt.albumSha256,
      receiptSha256:performance.receipt.receiptSha256
    },
    importBaseline:{
      selectiveRequests:observer.receipt.v0Receipt.requestedModules.length,
      eagerRequests:eager.receipt.v0Receipt.requestedModules.length,
      selectiveDeclaredMiB:observer.receipt.v0Receipt.declaredWorkingSetMiB,
      eagerDeclaredMiB:eager.receipt.v0Receipt.declaredWorkingSetMiB,
      sameObservableOutput:observer.receipt.v0Receipt.outputSha256===eager.receipt.v0Receipt.outputSha256
    },
    optionalSnapshot:args[0]||'not used'
  },null,2));
}
