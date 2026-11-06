/** Different source implementation, same declared observable report contract. */
export function run(diagnosis) {
  const parts = [diagnosis.asset, ': ', diagnosis.severity, ' (', diagnosis.interfaceCount, ' interfaces, ', diagnosis.errorTotal, ' errors)'];
  const actionMap = {
    critical: ['Inspect down interfaces', 'Review interface error counters'],
    warn: ['Review interface error counters'],
    ok: ['Continue normal monitoring']
  };
  return {
    asset: diagnosis.asset,
    severity: diagnosis.severity,
    summary: parts.join(''),
    actions: [...actionMap[diagnosis.severity]]
  };
}
