/** Deliberately malformed negative-control fixture; expected to fail closed. */
export function run(diagnosis) {
  return {asset: diagnosis.asset, severity: diagnosis.severity, summary: null, actions: []};
}
