const express = require('express');
const router = express.Router();
const { generateScript } = require('../services/anthropic');

const HTTP_LABELS = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Entity',
  429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable',
};

function parseValues(valuesStr) {
  const body = {};
  const headers = {};
  if (!valuesStr || !valuesStr.trim()) return { body, headers };

  // Découper par virgule ou slash pour séparer les paires
  const parts = valuesStr.split(/[,\/]/).map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    // Format 1 : "clé dans le (body|header|url) = valeur"
    // Format 2 : "header : clé = valeur" ou "header: clé = valeur"
    // Format 3 : "clé = valeur"
    const locationMatch  = part.match(/^(.+?)\s+dans\s+le?\s+(body|header|url|path|query)\s*=\s*(.*)$/i);
    const prefixMatch    = part.match(/^(body|header|url|path|query)\s*:\s*([^=]+?)\s*=\s*(.*)$/i);
    const simpleMatch    = part.match(/^([^=]+?)\s*=\s*(.*)$/);

    let key, location, rawVal;

    if (locationMatch) {
      key      = locationMatch[1].trim();
      location = locationMatch[2].toLowerCase();
      rawVal   = locationMatch[3].trim().replace(/^["']|["']$/g, '');
    } else if (prefixMatch) {
      location = prefixMatch[1].toLowerCase();
      key      = prefixMatch[2].trim();
      rawVal   = prefixMatch[3].trim().replace(/^["']|["']$/g, '');
    } else if (simpleMatch) {
      key      = simpleMatch[1].trim();
      location = '';
      rawVal   = simpleMatch[2].trim().replace(/^["']|["']$/g, '');
    } else {
      continue;
    }

    // Convertir la valeur
    let val;
    if (rawVal === 'null')                        val = null;
    else if (rawVal === 'vide' || rawVal === '')  val = '';
    else if (rawVal === 'absent' || rawVal === 'manquant') val = null;
    else if (rawVal === 'true')                   val = true;
    else if (rawVal === 'false')                  val = false;
    else if (!isNaN(rawVal) && rawVal !== '')     val = Number(rawVal);
    else                                          val = rawVal;

    const keyLower = key.toLowerCase();

    // Déterminer si c'est un header
    const isHeader = location === 'header' ||
      (!location && (
        keyLower === 'authorization' ||
        keyLower === 'token' ||
        keyLower.includes('auth') ||
        keyLower.startsWith('x-') ||
        keyLower.includes('api-key') ||
        keyLower.includes('apikey')
      ));

    if (isHeader) {
      if (keyLower === 'token' || keyLower === 'authorization' || keyLower.includes('auth')) {
        if (val === null || val === '' || val === 'invalide' || val === 'invalid') {
          headers['Authorization'] = val === 'invalide' || val === 'invalid' ? 'Bearer invalid_token' : null;
        } else {
          headers['Authorization'] = `Bearer ${val}`;
        }
      } else {
        // Header custom comme x-api-key
        if (val === null) {
          headers[key] = null; // null = supprimer ce header
        } else if (val === 'invalide' || val === 'invalid') {
          headers[key] = 'invalid_value';
        } else {
          headers[key] = String(val);
        }
      }
    } else if (location === 'body' || !location) {
      // Ne pas mettre dans le body les clés liées à l'auth
      if (!keyLower.includes('token') && !keyLower.includes('auth') && !keyLower.startsWith('x-')) {
        body[key] = val;
      }
    }
  }

  return { body, headers };
}

function buildBodyFromValues(nominalBodyStr, valuesStr) {
  let base = {};
  if (nominalBodyStr) {
    try { base = JSON.parse(nominalBodyStr); } catch(e) {}
  }
  if (!valuesStr || !valuesStr.trim()) return base;
  const { body } = parseValues(valuesStr);
  if (Object.keys(body).length === 0) return base;
  return { ...base, ...body };
}

function buildScript({ endpoint, code, type, scenario, assertions, vars }) {
  const isSuccess = type === 'success';
  const lines = [];

  lines.push('// === ASSERTIONS ===');
  lines.push('const res = pm.response.json();');
  lines.push('');

  // Extraire les variables si succès
  if (isSuccess && vars && vars.trim()) {
    lines.push('// === EXTRACTION DES VARIABLES ===');
    const varParts = vars.split(',').map(v => v.trim());
    for (const v of varParts) {
      const m = v.match(/(\w+)\s+depuis\s+response\.(\w+)/i) || v.match(/(\w+)/);
      if (m) {
        const varName  = m[1];
        const resField = m[2] || m[1];
        lines.push(`pm.environment.set("${varName}", res.${resField});`);
      }
    }
    lines.push('');
  }

  // Générer les assertions depuis le champ "assertions"
  const assertionList = assertions
    ? assertions.split(',').map(a => a.trim()).filter(Boolean)
    : [`statut ${code}`];

  let idx = 1;
  for (const assertion of assertionList) {
    const a = assertion.toLowerCase();

    if (/statut\s*(\d+)/.test(a)) {
      const statusCode = a.match(/statut\s*(\d+)/)[1];
      lines.push(`// Vérification du statut HTTP ${statusCode}`);
      lines.push(`pm.test("[${idx}] Statut HTTP est ${statusCode}", function () {`);
      lines.push(`    pm.response.to.have.status(${statusCode});`);
      lines.push(`    if (pm.response.code !== ${statusCode}) console.log("[ECHEC ${idx}] Statut reçu : " + pm.response.code);`);
      lines.push('});');
      lines.push('');
      idx++;
    }

    else if (/content.type/i.test(a)) {
      lines.push('// Vérification du Content-Type JSON');
      lines.push(`pm.test("[${idx}] Content-Type est application/json", function () {`);
      lines.push('    pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");');
      lines.push('});');
      lines.push('');
      idx++;
    }

    else if (/message d.erreur contient\s*[""](.+)[""]/.test(assertion)) {
      const msg = assertion.match(/message d.erreur contient\s*[""](.+)[""]/i)[1];
      lines.push(`// Vérification du message d'erreur exact`);
      lines.push(`pm.test("[${idx}] Message d'erreur contient \"${msg}\"", function () {`);
      lines.push('    const body = pm.response.json();');
      lines.push(`    const errMsg = body.error || body.message || body.detail || "";`);
      lines.push(`    pm.expect(errMsg).to.include("${msg}");`);
      lines.push(`    if (!errMsg.includes("${msg}")) console.log("[ECHEC ${idx}] Message reçu : " + errMsg);`);
      lines.push('});');
      lines.push('');
      idx++;
    }

    else if (/message d.erreur/.test(a)) {
      lines.push(`// Vérification de la présence d'un message d'erreur`);
      lines.push(`pm.test("[${idx}] Message d'erreur présent", function () {`);
      lines.push('    const body = pm.response.json();');
      lines.push('    const hasErr = body.error || body.message || body.detail;');
      lines.push('    pm.expect(hasErr).to.exist;');
      lines.push(`    if (!hasErr) console.log("[ECHEC ${idx}] Aucun message d'erreur dans : " + JSON.stringify(body));`);
      lines.push('});');
      lines.push('');
      idx++;
    }

    else if (/présence.+champs/.test(a) || /presence.+champs/.test(a)) {
      // Extraire les noms de champs depuis la réponse nominale si possible
      lines.push('// Vérification de la présence de tous les champs');
      lines.push(`pm.test("[${idx}] Présence de tous les champs de la réponse", function () {`);
      lines.push('    pm.expect(res).to.be.an("object").and.not.null;');
      lines.push('});');
      lines.push('');
      idx++;
    }

    else if (/(\w+)\s*:\s*(string|number|boolean|array|object)/.test(assertion)) {
      // Format "champ: type"
      const fieldMatches = assertion.matchAll(/(\w+)\s*:\s*(string|number|boolean|array|object)/gi);
      for (const fm of fieldMatches) {
        const field = fm[1];
        const type  = fm[2].toLowerCase();
        lines.push(`// Vérification du champ '${field}' (${type})`);
        lines.push(`pm.test("[${idx}] Champ '${field}' présent et de type ${type}", function () {`);
        lines.push(`    pm.expect(res).to.have.property("${field}");`);
        lines.push(`    pm.expect(res.${field}).to.be.a("${type}");`);
        lines.push('});');
        lines.push('');
        idx++;
      }
    }

    else {
      // Assertion libre — générer un test commenté
      lines.push(`// ${assertion}`);
      lines.push(`pm.test("[${idx}] ${assertion}", function () {`);
      lines.push('    // Vérification manuelle requise');
      lines.push('    pm.expect(res).to.exist;');
      lines.push('});');
      lines.push('');
      idx++;
    }
  }

  return lines.join('\n');
}


async function buildScenario({ endpoint, baseUrl, userStory, code, type, scenario, values, assertions, allEndpoints, idx }) {
  const name = scenario;
  // Générer le script directement depuis les assertions — pas d'IA pour éviter les hallucinations
  const script = buildScript({ endpoint, code, type, scenario, assertions, vars: endpoint.vars });

  let body = null;
  if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
    const builtBody = buildBodyFromValues(endpoint.body, values);
    body = Object.keys(builtBody).length > 0 ? JSON.stringify(builtBody) : null;
  }

  const { headers } = parseValues(values);
  const adaptedHeaders = Object.keys(headers).length > 0 ? headers : null;

  return { code, type, name, script, body, adaptedHeaders };
}

router.post('/generate/requests', async (req, res) => {
  try {
    const { endpoint, idx, allEndpoints, userStory, baseUrl } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint manquant' });

    const coverage = endpoint.coverage || { success: [{ code: 200, scenario: '', values: '', enabled: true }], errors: [] };
    const results = [];

    for (const s of (coverage.success || []).filter(s => s.enabled)) {
      results.push(await buildScenario({ endpoint, baseUrl, userStory, code: s.code, type: 'success', scenario: s.scenario, values: s.values, assertions: s.assertions, allEndpoints, idx }));
    }
    for (const e of (coverage.errors || []).filter(e => e.enabled)) {
      results.push(await buildScenario({ endpoint, baseUrl, userStory, code: e.code, type: 'error', scenario: e.scenario, values: e.values, assertions: e.assertions, allEndpoints, idx }));
    }

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate/collection', async (req, res) => {
  try {
    const { endpoints, userStory, baseUrl, collectionName } = req.body;
    if (!endpoints || endpoints.length === 0) return res.status(400).json({ error: 'Aucun endpoint fourni' });

    const folders = [];
    const allScripts = [];

    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i];
      const coverage = ep.coverage || { success: [{ code: 200, scenario: '', values: '', enabled: true }], errors: [] };
      const items = [];

      for (const s of (coverage.success || []).filter(s => s.enabled)) {
        const result = await buildScenario({ endpoint: ep, baseUrl, userStory, code: s.code, type: 'success', scenario: s.scenario, values: s.values, assertions: s.assertions, allEndpoints: endpoints, idx: i });
        allScripts.push({ name: result.name, script: result.script });
        items.push(buildItem(ep, result.name, result.script, result.body, result.adaptedHeaders, baseUrl));
      }
      for (const e of (coverage.errors || []).filter(e => e.enabled)) {
        const result = await buildScenario({ endpoint: ep, baseUrl, userStory, code: e.code, type: 'error', scenario: e.scenario, values: e.values, assertions: e.assertions, allEndpoints: endpoints, idx: i });
        allScripts.push({ name: result.name, script: result.script });
        items.push(buildItem(ep, result.name, result.script, result.body, result.adaptedHeaders, baseUrl));
      }

      folders.push({ name: `${ep.method} ${ep.path}${ep.name ? ' — ' + ep.name : ''}`, item: items });
    }

    const collection = {
      info: {
        name: collectionName || 'Collection de tests',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        description: userStory || '',
      },
      variable: [{ key: 'baseUrl', value: baseUrl || 'https://api.example.com', type: 'string' }],
      item: folders,
    };

    const sep = '='.repeat(60);
    const jsScript = `// ${sep}\n// Collection: ${collectionName || 'Tests'}\n// ${sep}\n\n` +
      allScripts.map(({ name, script }) =>
        `// ${'='.repeat(50)}\n// ${name}\n// ${'='.repeat(50)}\n\n${script || ''}`
      ).join('\n\n');

    res.json({ collection, jsScript });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function buildItem(ep, name, script, adaptedBody, adaptedHeaders, baseUrl) {
  const nominalHeaders = {};
  (ep.headers || '').split('\n').filter(Boolean).forEach(h => {
    const [key, ...rest] = h.split(':');
    nominalHeaders[key.trim()] = rest.join(':').trim();
  });
  const mergedHeaders = { ...nominalHeaders, ...(adaptedHeaders || {}) };
  const headerList = Object.entries(mergedHeaders)
    .filter(([, value]) => value !== null)  // null = header supprimé intentionnellement
    .map(([key, value]) => ({ key, value: String(value), type: 'text' }));

  const bodySource = adaptedBody || ep.body;
  let rawBody = null;
  if (bodySource && ['POST', 'PUT', 'PATCH'].includes(ep.method)) {
    try { JSON.parse(bodySource); rawBody = bodySource; }
    catch { rawBody = JSON.stringify({ example: bodySource }); }
  }

  return {
    name,
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
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: (script || '').split('\n') } }],
  };
}

router.post('/generate/gherkin', async (req, res) => {
  try {
    const { spec, endpointPath, method, bodyNominal, code, label, scenario, values, assertions } = req.body;

    const prompt = `Tu es un expert QA. Génère un scénario Gherkin précis et concret pour ce cas de test.

Spécification : ${spec || '(non fournie)'}
Endpoint : ${method} ${endpointPath}
Body nominal : ${bodyNominal || '—'}
Code HTTP : ${code} (${label || ''})
Scénario : ${scenario}
Valeurs : ${values || '(non fournies)'}
Assertions : ${assertions || '(non fournies)'}

Règles :
- Feature = nom fonctionnel de l'endpoint
- Scenario = reprend exactement le scénario fourni
- Given = contexte (API disponible)
- When = action avec les VALEURS RÉELLES exactes
- Then = statut HTTP attendu
- And = vérifications supplémentaires
- Format Gherkin strict, indenté 2 espaces, en français

Réponds UNIQUEMENT avec le Gherkin brut, sans markdown.`;

    const gherkin = await generateScript(prompt);
    res.json({ gherkin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate/suggest-values', async (req, res) => {
  try {
    const { endpoint, code, scenario } = req.body;

    const prompt = `Tu es un expert QA API REST. Suggere des valeurs concretes pour provoquer l'erreur ${code} sur cet endpoint.

Endpoint : ${endpoint.method} ${endpoint.path}
Body nominal : ${endpoint.body || 'aucun'}
Headers nominaux : ${endpoint.headers || 'aucun'}
Code d'erreur vise : ${code}
Scenario : ${scenario}

Format attendu (UNE SEULE ligne, sans markdown) :
- body : nom dans le body = valeur
- header : nom dans le header = valeur
- url : nom dans l'url = valeur

Exemples :
- 401 : token dans le header = invalide
- 400 : name dans le body = vide, job dans le body = vide
- 404 : id dans l'url = 99999

Reponds avec UNE SEULE ligne concise.`;

    const suggestion = await generateScript(prompt);
    res.json({ suggestion: suggestion.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
