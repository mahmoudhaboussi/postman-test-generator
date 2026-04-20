export function buildFeatureFile(endpoint, spec) {
  const coverage = endpoint.coverage || { success: [], errors: [] };
  const allScenarios = [
    ...(coverage.success || []).filter(s => s.enabled && s.gherkin),
    ...(coverage.errors  || []).filter(e => e.enabled && e.gherkin),
  ];

  if (allScenarios.length === 0) return null;

  const featureName = `${endpoint.method} ${endpoint.path}${endpoint.name ? ' — ' + endpoint.name : ''}`;
  const description = spec ? `  ${spec.replace(/\n/g, '\n  ')}` : '';

  const scenariosText = allScenarios.map(s => {
    // Extraire uniquement le bloc Scenario du Gherkin généré (sans le Feature)
    const lines = s.gherkin.split('\n');
    const scenarioStart = lines.findIndex(l => l.trim().startsWith('Scenario'));
    if (scenarioStart !== -1) {
      return lines.slice(scenarioStart).join('\n');
    }
    return s.gherkin;
  }).join('\n\n');

  return `Feature: ${featureName}\n${description ? description + '\n' : ''}\n${scenariosText}`;
}

export function downloadFeatureFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAllAsZip(endpoints, spec) {
  // Utilise JSZip via CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  document.head.appendChild(script);

  await new Promise(resolve => script.onload = resolve);

  const zip = new window.JSZip();

  endpoints.forEach((ep, i) => {
    const content = buildFeatureFile(ep, spec);
    if (content) {
      const filename = `${String(i + 1).padStart(2, '0')}_${ep.method}_${ep.path.replace(/\//g, '_').replace(/:/g, '').replace(/\?.*$/, '')}.feature`;
      zip.file(filename, content);
    }
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gherkin_scenarios.zip';
  a.click();
  URL.revokeObjectURL(url);
}
