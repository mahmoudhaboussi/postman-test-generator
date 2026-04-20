export function validateEndpoint(endpoint, allEndpoints, idx) {
  const errors = [];
  const warnings = [];

  if (!endpoint.path?.trim()) {
    errors.push('Le chemin est obligatoire (ex: /posts/:id).');
  }

  const coverage = endpoint.coverage;
  const hasAnyCoverage =
    coverage?.success?.some(s => s.enabled) ||
    coverage?.errors?.some(e => e.enabled);

  if (!hasAnyCoverage) {
    errors.push('Aucun code HTTP coché — coche au moins un code dans la couverture.');
  }

  const pathVars = (endpoint.path || '').match(/\{\{(\w+)\}\}/g) || [];
  pathVars.forEach(v => {
    const varName = v.replace(/\{\{|\}\}/g, '');
    const extractedBefore = allEndpoints
      .slice(0, idx)
      .some(ep => ep.vars?.toLowerCase().includes(varName.toLowerCase()));
    if (!extractedBefore) {
      errors.push(`Variable "{{${varName}}}" utilisée dans le chemin mais jamais extraite dans les étapes précédentes.`);
    }
  });

  if (['GET', 'DELETE'].includes(endpoint.method) && endpoint.body?.trim()) {
    warnings.push(`Un body est défini sur une requête ${endpoint.method} — il sera ignoré par HTTP.`);
  }

  return { errors, warnings, isValid: errors.length === 0 };
}
