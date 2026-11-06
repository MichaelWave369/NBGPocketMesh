/** Report arrangement A. */
export function run(diagnosis) {
  return {
    asset: diagnosis.asset,
    severity: diagnosis.severity,
    summary: diagnosis.asset + ': ' + diagnosis.severity + ' (' + diagnosis.interfaceCount + ' interfaces, ' + diagnosis.errorTotal + ' errors)',
    actions: diagnosis.severity === 'critical'
      ? ['Inspect down interfaces', 'Review interface error counters']
      : diagnosis.severity === 'warn'
        ? ['Review interface error counters']
        : ['Continue normal monitoring']
  };
}
