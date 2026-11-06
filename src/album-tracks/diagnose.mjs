/** Fixed transparent rules, not model inference. */
export function run(observation) {
  const severity = observation.down.length ? 'critical' : observation.errorTotal >= 5 ? 'warn' : 'ok';
  const findings = [];
  if (observation.down.length) findings.push('Down: ' + observation.down.join(', '));
  if (observation.errorTotal >= 5) findings.push('Elevated interface error count');
  if (!findings.length) findings.push('No configured alert threshold exceeded');
  return {
    asset: observation.asset,
    severity,
    findings,
    interfaceCount: observation.interfaceCount,
    errorTotal: observation.errorTotal
  };
}
