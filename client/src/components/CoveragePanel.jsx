import React, { useState } from 'react';
import { generateGherkin, suggestValues } from '../services/api';
import styles from './CoveragePanel.module.css';

const HTTP_LABELS = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable',
  429: 'Too Many Requests', 500: 'Server Error', 503: 'Unavailable',
};

const DEFAULT_SCENARIOS = {
  200: { scenario: 'Récupération réussie avec des données valides.', assertions: 'statut 200, Content-Type JSON, présence et types de tous les champs' },
  201: { scenario: 'Création réussie avec toutes les données valides.', assertions: 'statut 201, Content-Type JSON, id: number, présence de tous les champs' },
  202: { scenario: 'Requête acceptée pour traitement asynchrone.', assertions: 'statut 202, Content-Type JSON' },
  204: { scenario: 'Suppression ou action réussie sans contenu.', assertions: 'statut 204, corps vide' },
  400: { scenario: 'Body invalide — champs manquants ou format incorrect.', assertions: "statut 400, message d'erreur présent" },
  401: { scenario: 'Token manquant ou invalide dans le header Authorization.', assertions: "statut 401, message d'erreur présent" },
  403: { scenario: 'Token valide mais droits insuffisants.', assertions: "statut 403, message d'erreur présent" },
  404: { scenario: 'Identifiant inexistant ou ressource introuvable.', assertions: "statut 404, message d'erreur présent" },
  409: { scenario: 'Conflit — ressource déjà existante.', assertions: "statut 409, message d'erreur présent" },
  422: { scenario: 'Données syntaxiquement correctes mais métier invalides.', assertions: "statut 422, message d'erreur présent" },
  429: { scenario: 'Trop de requêtes — limite de débit atteinte.', assertions: "statut 429, message d'erreur présent" },
  500: { scenario: 'Données inattendues provoquant une erreur serveur.', assertions: "statut 500, message d'erreur présent" },
  503: { scenario: 'Service temporairement indisponible.', assertions: "statut 503, message d'erreur présent" },
};

const ERROR_CODES = [400, 401, 403, 404, 409, 422, 429, 500, 503];

export function getDefaultCoverage() {
  return {
    success: [{ code: 200, enabled: false, scenario: DEFAULT_SCENARIOS[200].scenario, values: '', assertions: DEFAULT_SCENARIOS[200].assertions, gherkin: '' }],
    errors: ERROR_CODES.map(code => ({ code, enabled: false, scenario: DEFAULT_SCENARIOS[code].scenario, values: '', assertions: DEFAULT_SCENARIOS[code].assertions, gherkin: '' })),
  };
}

function ScenarioRow({ item, type, endpoint, spec, onUpdate, onDuplicate, onRemove, canRemove }) {
  const [showGherkin, setShowGherkin] = useState(!!item.gherkin);
  const [generatingGherkin, setGeneratingGherkin] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const isSuccess = type === 'success';

  const handleSuggest = async () => {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const suggestion = await suggestValues({ endpoint, code: item.code, scenario: item.scenario });
      onUpdate('values', suggestion);
    } catch (err) {
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  };

  const handleGherkin = async () => {
    if (generatingGherkin) return;
    setShowGherkin(true);
    setGeneratingGherkin(true);
    try {
      const gherkin = await generateGherkin({
        spec,
        endpointPath: endpoint.path,
        method: endpoint.method,
        bodyNominal: endpoint.body,
        code: item.code,
        label: HTTP_LABELS[item.code] || '',
        scenario: item.scenario,
        values: item.values,
        assertions: item.assertions,
      });
      onUpdate('gherkin', gherkin);
    } catch (err) {
      onUpdate('gherkin', 'Erreur : ' + err.message);
    } finally {
      setGeneratingGherkin(false);
    }
  };

  const copyGherkin = () => {
    if (item.gherkin) navigator.clipboard.writeText(item.gherkin);
  };

  return (
    <div className={`${styles.row} ${item.enabled ? (isSuccess ? styles.rowSuccessOn : styles.rowErrorOn) : ''}`}>
      <div className={styles.rowHeader}>
        <input type="checkbox" className={`${styles.cb} ${isSuccess ? styles.cbSuccess : styles.cbError}`}
          checked={!!item.enabled} onChange={e => onUpdate('enabled', e.target.checked)} />
        <span className={`${styles.badge} ${item.enabled ? (isSuccess ? styles.badgeSuccessOn : styles.badgeErrorOn) : styles.badgeOff}`}>
          {item.code}
        </span>
        <span className={`${styles.rowLabel} ${item.enabled ? styles.rowLabelOn : ''}`}>
          {HTTP_LABELS[item.code] || (isSuccess ? 'Success' : `Erreur ${item.code}`)}
        </span>
        {item.enabled && (
          <div className={styles.scenarioActions}>
            <button className={`${styles.actionBtn} ${styles.btnGherkin}`}
              onClick={handleGherkin} disabled={generatingGherkin}>
              {generatingGherkin ? <span className={styles.spinner} /> : '✦'} Gherkin
            </button>
            <button className={`${styles.actionBtn} ${styles.btnDup}`} onClick={onDuplicate}>⧉ Dupliquer</button>
          </div>
        )}
        {(!isSuccess || canRemove) && (
          <button className={styles.removeBtn} onClick={onRemove}>✕</button>
        )}
      </div>

      {item.enabled && (
        <div className={styles.rowBody}>
          <div className={styles.rowInline}>
            <div>
              <label>Scénario <span className={styles.tag}>= nom dans la collection</span></label>
              <input type="text" value={item.scenario} onChange={e => onUpdate('scenario', e.target.value)} />
            </div>
            <div>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px'}}>
                <label style={{margin:0}}>Valeurs pour ce scénario</label>
                {!isSuccess && (
                  <button className={styles.suggestBtn} onClick={handleSuggest} disabled={suggesting}>
                    {suggesting ? <span className={styles.spinner} /> : '✦'} Suggérer
                  </button>
                )}
              </div>
              <input type="text" value={item.values} onChange={e => onUpdate('values', e.target.value)}
                placeholder="ex: id dans l'url = 99999 / title dans le body = vide / token dans le header = invalide" />
            </div>
          </div>
          <div>
            <label>Assertions attendues <span className={styles.tag}>utilisées par l'IA</span></label>
            <input type="text" value={item.assertions} onChange={e => onUpdate('assertions', e.target.value)}
              placeholder="ex: statut 201, id: number, title: string" />
          </div>

          {showGherkin && (
            <div className={styles.gherkinBox}>
              <div className={styles.gherkinHeader}>
                <span className={styles.gherkinTitle}>✦ Gherkin généré</span>
                <button className={styles.gherkinCopy} onClick={copyGherkin}>Copier</button>
              </div>
              <div className={styles.gherkinContent}>
                {generatingGherkin
                  ? <span className={styles.gherkinLoading}><span className={styles.spinner} /> Génération en cours…</span>
                  : (item.gherkin || <span className={styles.gherkinEmpty}>En attente…</span>)
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoveragePanel({ coverage, onChange, endpoint, spec }) {
  const { success = [], errors = [] } = coverage;

  const updateItem = (list, idx, field, value) =>
    list.map((item, i) => i === idx ? { ...item, [field]: value } : item);

  const duplicateItem = (list, idx) => {
    const copy = { ...list[idx], gherkin: '', scenario: list[idx].scenario + ' (copie)' };
    const next = [...list];
    next.splice(idx + 1, 0, copy);
    return next;
  };

  const addSuccess = () => {
    const input = prompt('Code de succès à ajouter (ex: 201, 204)');
    const code = parseInt(input || '0');
    if (!code || code < 200 || code > 299) return;
    if (success.find(s => s.code === code)) return;
    const def = DEFAULT_SCENARIOS[code] || { scenario: `Requête valide — statut ${code}.`, assertions: `statut ${code}` };
    onChange({ ...coverage, success: [...success, { code, enabled: true, scenario: def.scenario, values: '', assertions: def.assertions, gherkin: '' }] });
  };

  const addError = () => {
    const input = prompt("Code d'erreur à ajouter (ex: 429, 503)");
    const code = parseInt(input || '0');
    if (!code || code < 400 || code > 599) return;
    if (errors.find(e => e.code === code)) return;
    const def = DEFAULT_SCENARIOS[code] || { scenario: `Erreur ${code}.`, assertions: `statut ${code}, message d'erreur présent` };
    onChange({ ...coverage, errors: [...errors, { code, enabled: true, scenario: def.scenario, values: '', assertions: def.assertions, gherkin: '' }] });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>Codes de succès — une requête par code</div>
      {success.map((s, i) => (
        <ScenarioRow key={`s-${i}`} item={s} type="success" endpoint={endpoint} spec={spec}
          onUpdate={(field, value) => onChange({ ...coverage, success: updateItem(success, i, field, value) })}
          onDuplicate={() => onChange({ ...coverage, success: duplicateItem(success, i) })}
          onRemove={() => onChange({ ...coverage, success: success.filter((_, j) => j !== i) })}
          canRemove={success.length > 1} />
      ))}
      <button className={`${styles.addBtn} ${styles.addBtnSuccess}`} onClick={addSuccess}>+ Ajouter un code de succès</button>

      <div className={styles.divider} />
      <div className={styles.sectionTitle}>Codes d'erreurs — une requête par code</div>
      {errors.map((e, i) => (
        <ScenarioRow key={`e-${i}`} item={e} type="error" endpoint={endpoint} spec={spec}
          onUpdate={(field, value) => onChange({ ...coverage, errors: updateItem(errors, i, field, value) })}
          onDuplicate={() => onChange({ ...coverage, errors: duplicateItem(errors, i) })}
          onRemove={() => onChange({ ...coverage, errors: errors.filter((_, j) => j !== i) })}
          canRemove={true} />
      ))}
      <button className={`${styles.addBtn} ${styles.addBtnError}`} onClick={addError}>+ Ajouter un code d'erreur</button>
    </div>
  );
}
