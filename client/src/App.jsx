import React, { useState, useEffect } from 'react';
import TestCaseForm from './components/TestCaseForm';
import EndpointCard from './components/EndpointCard';
import ExportBar from './components/ExportBar';
import { generateRequests, generateCollection } from './services/api';
import { getDefaultCoverage } from './components/CoveragePanel';
import { exportAllAsZip } from './utils/featureExporter';
import styles from './App.module.css';

const STORAGE_KEY = 'ptg_state_v2';
const DEFAULT_FORM = { spec: '', collectionName: '', baseUrl: '' };

let counter = 0;
const newEndpoint = () => ({
  id: ++counter,
  method: 'POST', path: '', name: '',
  body: '', responses: '', headers: '', vars: '',
  coverage: getDefaultCoverage(''),
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved.endpoints?.length) counter = Math.max(...saved.endpoints.map(e => e.id), 0);
    return saved;
  } catch { return null; }
}

export default function App() {
  const saved = loadState();
  const [form, setForm] = useState(saved?.form || DEFAULT_FORM);
  const [endpoints, setEndpoints] = useState(saved?.endpoints || []);
  const [previews, setPreviews] = useState(saved?.previews || {});
  const [generating, setGenerating] = useState({});
  const [assembling, setAssembling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, endpoints, previews })); } catch {}
  }, [form, endpoints, previews]);

  const handleReset = () => {
    if (!resetConfirm) { setResetConfirm(true); setTimeout(() => setResetConfirm(false), 3000); return; }
    localStorage.removeItem(STORAGE_KEY);
    setForm(DEFAULT_FORM); setEndpoints([]); setPreviews({});
    setResult(null); setError(''); setResetConfirm(false); counter = 0;
  };

  const addEndpoint = () => setEndpoints(prev => [...prev, newEndpoint()]);
  const addEndpointAfter = (id) => setEndpoints(prev => {
    const idx = prev.findIndex(ep => ep.id === id);
    const next = [...prev];
    next.splice(idx + 1, 0, newEndpoint());
    return next;
  });
  const updateEndpoint = (id, updated) => setEndpoints(prev => prev.map(ep => ep.id === id ? updated : ep));
  const removeEndpoint = (id) => {
    setEndpoints(prev => prev.filter(ep => ep.id !== id));
    setPreviews(prev => { const next = { ...prev }; delete next[id]; return next; });
  };
  const moveEndpoint = (id, dir) => setEndpoints(prev => {
    const idx = prev.findIndex(ep => ep.id === id);
    const next = [...prev];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return prev;
    [next[idx], next[to]] = [next[to], next[idx]];
    return next;
  });

  const handlePreview = async (id) => {
    const idx = endpoints.findIndex(ep => ep.id === id);
    setGenerating(prev => ({ ...prev, [id]: true }));
    setError('');
    try {
      const results = await generateRequests({
        endpoint: endpoints[idx], idx,
        allEndpoints: endpoints,
        userStory: form.spec,
        baseUrl: form.baseUrl,
      });
      setPreviews(prev => ({ ...prev, [id]: results }));
    } catch (err) {
      setError(`Erreur : ${err.message}`);
    } finally {
      setGenerating(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAssemble = async () => {
    if (endpoints.length === 0) { setError('Ajoute au moins un endpoint.'); return; }
    setAssembling(true); setError('');
    try {
      const data = await generateCollection({
        endpoints, userStory: form.userStory,
        baseUrl: form.baseUrl, collectionName: form.collectionName,
      });
      setResult({ jsScript: data.jsScript, collection: data.collection });
    } catch (err) {
      setError(`Erreur assemblage : ${err.message}`);
    } finally { setAssembling(false); }
  };

  const handleClearGenerated = () => {
    setPreviews({});
    setResult(null);
    setError('');
  };

  const doneCount = endpoints.filter(ep => previews[ep.id]?.length > 0).length;
  const total = endpoints.length;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Postman Test Generator</h1>
          <p className={styles.subtitle}>Génère des scripts de test JS Postman depuis ton contrat d'interface</p>
        </div>
        <button className={`${styles.resetBtn} ${resetConfirm ? styles.resetConfirm : ''}`} onClick={handleReset}>
          {resetConfirm ? 'Confirmer ?' : 'Réinitialiser'}
        </button>
      </header>

      <main className={styles.main}>
        <TestCaseForm values={form} onChange={setForm} />
        <hr className="divider" />

        <div className={styles.endpointsHeader}>
          <span className={styles.endpointsLabel}>Contrats d'interface</span>
        </div>

        {endpoints.length === 0 ? (
          <div className={styles.emptyState} onClick={addEndpoint} style={{ cursor: 'pointer' }}>
            Aucun endpoint — clique ici pour en ajouter un
          </div>
        ) : (
          endpoints.map((ep, i) => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              index={i}
              total={endpoints.length}
              allEndpoints={endpoints}
              previews={previews[ep.id] || null}
              isGenerating={!!generating[ep.id]}
              onChange={(updated) => updateEndpoint(ep.id, updated)}
              onRemove={() => removeEndpoint(ep.id)}
              onMoveUp={() => moveEndpoint(ep.id, -1)}
              onMoveDown={() => moveEndpoint(ep.id, 1)}
              onPreview={() => handlePreview(ep.id)}
              onAddAfter={() => addEndpointAfter(ep.id)}
              spec={form.spec}
            />
          ))
        )}

        <hr className="divider" />
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.assembleBar}>
          <button className={styles.btnPrimary} onClick={handleAssemble}
            disabled={assembling || endpoints.length === 0}>
            {assembling ? <><span className={styles.spinner} /> Génération en cours…</> : 'Générer le code'}
          </button>
          <button className={styles.btnClear}
            onClick={handleClearGenerated}
            disabled={!result && doneCount === 0}
            title="Vider le code généré en gardant la configuration">
            Vider le généré
          </button>
        </div>

        <div style={{marginTop:'8px'}}>
          <button
            className={styles.btnSecondary}
            onClick={() => exportAllAsZip(endpoints, form.spec)}
            disabled={endpoints.length === 0}
          >
            ↓ Exporter tous les Gherkin (.zip)
          </button>
        </div>

        {result && (
          <ExportBar jsScript={result.jsScript} collection={result.collection} collectionName={form.collectionName} />
        )}
      </main>
    </div>
  );
}
