export const TASK = Object.freeze({
  id:'fixture-001', capability:'summarize', input:'text', output:'text',
  privacy:'private', remoteConsent:false, requiredLineages:1,
  latencyBudgetMs:150, memoryBudgetMiB:512
});

// Synthetic capability manifests are demonstration fixtures, NOT running AI models.
export const MANIFESTS = Object.freeze([
  {id:'tiny-local',revision:'fixture-a',capabilities:['summarize','classify'],inputs:['text'],outputs:['text'],transport:'local',status:'admitted',validThroughEpoch:1,estimatedLatencyMs:30,workingSetMiB:128,lineage:'fixture-family-a',resident:true},
  {id:'image-local',revision:'fixture-b',capabilities:['describe'],inputs:['image'],outputs:['text'],transport:'local',status:'admitted',validThroughEpoch:1,estimatedLatencyMs:60,workingSetMiB:256,lineage:'fixture-family-b',resident:false},
  {id:'cloud-summarizer',revision:'fixture-c',capabilities:['summarize'],inputs:['text'],outputs:['text'],transport:'remote',status:'admitted',validThroughEpoch:1,estimatedLatencyMs:15,workingSetMiB:8,lineage:'fixture-family-c',resident:false}
]);
