import React from 'react';
import styles from './TestCaseForm.module.css';

export default function TestCaseForm({ values, onChange }) {
  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });


  return (
    <div className={styles.card}>
      <div className={styles.field}>
        <label>Spécification — description de l'endpoint</label>
        <textarea
          rows={3}
          value={values.spec}
          onChange={set('spec')}
          placeholder="Ex: Cet endpoint permet de créer un nouveau post avec un titre, un contenu et un identifiant utilisateur. Il retourne le post créé avec son id généré."
        />
      </div>
      <div className={styles.row2}>
        <div className={styles.field}>
          <label>Nom de la collection Postman</label>
          <input type="text" value={values.collectionName} onChange={set('collectionName')}
            placeholder="ex: Tests authentification" />
        </div>
        <div className={styles.field}>
          <label>Base URL</label>
          <input type="text" value={values.baseUrl} onChange={set('baseUrl')}
            placeholder="https://api.monapp.com" />
        </div>
      </div>
    </div>
  );
}
