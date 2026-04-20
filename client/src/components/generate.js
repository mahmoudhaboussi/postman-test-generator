const express = require('express');
const router = express.Router();
const { generateScript } = require('../services/anthropic');

function buildSinglePrompt({ endpoint, idx, allEndpoints, testcase, baseUrl, tcMode, coverage }) {
  const tcLabel = tcMode === 'gherkin' ? 'Scénario Gherkin (Given/When/Then)' : 'Cas de test en français';
  const stepsContext = allEndpoints
    .map((e, i) => `Étape ${i + 1}: ${e.method} ${e.path}${e.vars ? ' → extrait: ' + e.vars : ''}`)
    .join('\n');

  const coverageLines = [];
  if (coverage?.nominal !== false) coverageLines.push('- Cas nominaux : parcours standard, réponses attendues');
  if (coverage?.error)             coverageLines.push('- Cas d\'erreurs : erreurs HTTP (4xx/5xx), auth invalide, validation');
  if (coverage?.edge)              coverageLines.push('- Cas limites : valeurs vides, null, chaînes longues, types incorrects');
  const coverageInstr = coverageLines.length
    ? `Niveaux de couverture à générer :\n${coverageLines.join('\n')}`
    : 'Génère les cas nominaux uniquement.';

  return `Tu es un expert Postman. Génère uniquement le script de test JavaScript Postman pour CET endpoint précis.

Contexte du parcours: ${testcase || '(non fourni)'}
${tcLabel}

Ordre des endpoints dans le parcours:
${stepsContext}

Endpoint à générer (étape ${idx + 1}):
  Méthode: ${endpoint.method}
  Chemin: ${endpoint.path}
  Nom: ${endpoint.name || '—'}
  Base URL: ${baseUrl}
  Body/Payload: ${endpoint.body || '—'}
  Réponses attendues: ${endpoint.responses || '—'}
  Headers: ${endpoint.headers || '—'}
  Variables à extraire: ${endpoint.vars || '—'}

Instructions:
- ${coverageInstr}
- Code JS uniquement pour l'onglet "Tests" Postman
- Utilise pm.test(), pm.expect(), pm.response
- Si des variables sont à extraire, utilise pm.environment.set()
- Si cette étape dépend de variables des étapes précédentes, utilise pm.environment.get()
- Couvre les cas positifs ET négatifs (status codes, structure, types)
- Commentaires en français, noms de tests lisibles en français dans pm.test("...")
Réponds UNIQUEMENT avec le code JavaScript brut, sans markdown, sans explication.`;
}

// POST /api/generate/single — génère le script pour un seul endpoint
router.post('/generate/single', async (req, res) => {
  try {
    const { endpoint, idx, allEndpoints, testcase, baseUrl, tcMode, coverage } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint manquant' });

    const prompt = buildSinglePrompt({ endpoint, idx, allEndpoints, testcase, baseUrl, tcMode, coverage });
    const script = await generateScript(prompt);
    res.json({ script });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate/collection — génère tous les scripts et retourne le JSON Postman v2.1
router.post('/generate/collection', async (req, res) => {
  try {
    const { endpoints, testcase, baseUrl, collectionName, tcMode, coverage } = req.body;
    if (!endpoints || endpoints.length === 0)
      return res.status(400).json({ error: 'Aucun endpoint fourni' });

    // Générer les scripts pour tous les endpoints
    const scripts = [];
    for (let i = 0; i < endpoints.length; i++) {
      const script = await generateScript(
        buildSinglePrompt({
          endpoint: endpoints[i],
          idx: i,
          allEndpoints: endpoints,
          testcase,
          baseUrl,
          tcMode,
          coverage,
        })
      );
      scripts.push(script);
    }

    // Construire la collection Postman v2.1
    const items = endpoints.map((ep, i) => {
      const headerList = ep.headers
        ? ep.headers.split('\n').filter(Boolean).map((h) => {
            const [key, ...rest] = h.split(':');
            return { key: key.trim(), value: rest.join(':').trim(), type: 'text' };
          })
        : [];

      let rawBody = null;
      if (ep.body && ['POST', 'PUT', 'PATCH'].includes(ep.method)) {
        try { JSON.parse(ep.body); rawBody = ep.body; }
        catch { rawBody = JSON.stringify({ example: ep.body }); }
      }

      return {
        name: ep.name || `${ep.method} ${ep.path}`,
        request: {
          method: ep.method,
          header: headerList,
          body: rawBody ? { mode: 'raw', raw: rawBody, options: { raw: { language: 'json' } } } : undefined,
          url: {
            raw: `{{baseUrl}}${ep.path}`,
            host: ['{{baseUrl}}'],
            path: ep.path.replace(/^\//, '').split('/'),
          },
        },
        event: [{ listen: 'test', script: { type: 'text/javascript', exec: scripts[i].split('\n') } }],
      };
    });

    const collection = {
      info: {
        name: collectionName || 'Collection de tests',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        description: testcase || '',
      },
      variable: [{ key: 'baseUrl', value: baseUrl || 'https://api.example.com', type: 'string' }],
      item: items,
    };

    // Assembler aussi le script JS combiné
    const jsScript =
      `// ${'='.repeat(60)}\n// Collection: ${collectionName || 'Tests'}\n// ${endpoints.length} endpoint(s)\n// ${'='.repeat(60)}\n\n` +
      endpoints
        .map(
          (ep, i) =>
            `// ${'='.repeat(50)}\n// Endpoint ${i + 1}: ${ep.method} ${ep.path}${ep.name ? ' — ' + ep.name : ''}\n// ${'='.repeat(50)}\n\n` +
            scripts[i]
        )
        .join('\n\n');

    res.json({ collection, jsScript, scripts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
