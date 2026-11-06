/** Deterministic local fixture observer. No live device, socket, or shell access. */
export function run(input) {
  const links = [...input.interfaces].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return {
    asset: input.asset,
    interfaceCount: links.length,
    down: links.filter(link => link.status === 'down').map(link => link.id),
    errorTotal: links.reduce((sum, link) => sum + link.errors, 0)
  };
}
