import React, { useState } from 'react';
import { validateEndpoint } from '../utils/validateEndpoint';
import { buildFeatureFile, downloadFeatureFile } from '../utils/featureExporter';
import CoveragePanel, { getDefaultCoverage } from './CoveragePanel';
import styles from './EndpointCard.module.css';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const METHOD_COLORS = {
  GET: styles.methodGet, POST: styles.methodPost,
  PUT: styles.methodPut, PATCH: styles.methodPatch, DELETE: styles.methodDelete,
};

export default function EndpointCard({
  endpoint, index, total, allEndpoints,
  previews, isGenerating,
  onChange, onRemove, onMoveUp, onMoveDown, onPreview, onAddAfter, spec,
}) {
  const [open, setOpen] = useState(true);
  const [validation, setValidation] = useState(null);

  const set = (field) => (e) => onChange({ ...endpoint, [field]: e.target.value });

  const handlePreview = () => {
    const result = validateEndpoint(endpoint, allEndpoints, index);
    setValidation(result);
    if (result.isValid) onPreview();
  };

  const handleExportFeature = () => {
    const content = buildFeatureFile(endpoint, spec);
    if (!content) { alert('Aucun Gherkin généré — clique sur ✦ Gherkin sur chaque scénario d\'abord.'); return; }
    const filename = `${endpoint.method}_${endpoint.path.replace(/\//g, '_').replace(/:/g, '').replace(/\?.*/,'')}.feature`;
    downloadFeatureFile(content, filename);
  };

  const coverage = endpoint.coverage || getDefaultCoverage();
  const title = endpoint.name || (endpoint.path ? `${endpoint.method} ${endpoint.path}` : 'Nouvel endpoint');
  const hasPreview = previews && previews.length > 0;

  return (
    <div className={`${styles.card} ${hasPreview ? styles.previewed : ''}`}>
      <div className={styles.header} onClick={() => setOpen(o => !o)}>
        <span className={`${styles.num} ${hasPreview ? styles.numDone : ''}`}>
          {hasPreview ? '✓' : index + 1}
        </span>
        <span className={`${styles.methodBadge} ${METHOD_COLORS[endpoint.method] || ''}`}>{endpoint.method}</span>
        <span className={styles.title}>{title}</span>
        <div className={styles.actions} onClick={e => e.stopPropagation()}>
          {index > 0 && <button className={styles.iconBtn} onClick={onMoveUp}>↑</button>}
          {index < total - 1 && <button className={styles.iconBtn} onClick={onMoveDown}>↓</button>}
          <button className={styles.iconBtn} onClick={onRemove}>✕</button>
        </div>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▾</span>
      </div>

      {open && (
        <div className={styles.body}>
          <div className={styles.row3}>
            <div>
              <label>Méthode</label>
              <select value={endpoint.method} onChange={set('method')}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label>Chemin</label>
              <input type="text" value={endpoint.path} onChange={set('path')}
                placeholder="/posts/:id?page=&limit=" />
              <div className={styles.pathHint}>
                <span><code>:id</code> → path variable</span>
                <span><code>?param=</code> → query param</span>
              </div>
            </div>
            <div>
              <label>Nom de la requête</label>
              <input type="text" value={endpoint.name} onChange={set('name')} placeholder="Créer un post" />
            </div>
          </div>

          <div className={styles.row2}>
            <div>
              <label>Body nominal</label>
              <textarea rows={3} value={endpoint.body} onChange={set('body')}
                placeholder='{ "title": "Mon titre", "body": "Contenu", "userId": 1 }' />
            </div>
            <div>
              <label>Headers / Auth</label>
              <textarea rows={3} value={endpoint.headers} onChange={set('headers')}
                placeholder={"Authorization: Bearer {{token}}\nContent-Type: application/json"} />
            </div>
          </div>

          <div className={styles.field}>
            <label>Variables à extraire pour les étapes suivantes</label>
            <input type="text" value={endpoint.vars} onChange={set('vars')}
              placeholder="ex: postId depuis response.id" />
          </div>

          <div className={styles.divider} />

          <CoveragePanel
            coverage={coverage}
            endpoint={endpoint}
            spec={spec}
            onChange={(newCoverage) => onChange({ ...endpoint, coverage: newCoverage })}
          />

          {validation && validation.errors.length > 0 && (
            <div className={styles.validationErrors}>
              <span className={styles.validationTitle}>Erreurs — génération bloquée</span>
              {validation.errors.map((e, i) => (
                <div key={i} className={styles.validationItem}><span className={styles.iconError}>✕</span> {e}</div>
              ))}
            </div>
          )}

          {validation && validation.warnings.length > 0 && (
            <div className={styles.validationWarnings}>
              <span className={styles.validationTitle}>Avertissements</span>
              {validation.warnings.map((w, i) => (
                <div key={i} className={styles.validationItem}><span className={styles.iconWarn}>!</span> {w}</div>
              ))}
            </div>
          )}

          <div className={styles.exportFeatureBar}>
            <button className={styles.exportFeatureBtn} onClick={handleExportFeature}>
              ↓ Exporter .feature
            </button>
          </div>

          {hasPreview && !isGenerating && (
            <div className={styles.previewBar}>
              <span className={styles.previewOk}>
                ✓ {previews.length} requête{previews.length > 1 ? 's' : ''} générée{previews.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {isGenerating && (
            <div className={styles.previewBar}>
              <span className={styles.spinner} /> <span style={{fontSize:'12px',color:'var(--color-text-secondary)'}}>Génération…</span>
            </div>
          )}

          {hasPreview && previews.map((p, i) => (
            <div key={i} className={styles.previewBox}>
              <div className={styles.previewHeader}>
                <span className={`${styles.previewBadge} ${p.type === 'success' ? styles.previewBadgeSuccess : styles.previewBadgeError}`}>
                  {p.code}
                </span>
                <span className={styles.previewLabel}>{p.name}</span>
                <button className={styles.copySmall} onClick={() => navigator.clipboard.writeText(p.script)}>Copier</button>
              </div>
              <pre className={styles.previewCode}>{p.script}</pre>
            </div>
          ))}
        </div>
      )}

      <div className={styles.addAfterBar}>
        <button className={styles.addAfterBtn} onClick={onAddAfter}>+ Ajouter un endpoint</button>
      </div>
    </div>
  );
}
