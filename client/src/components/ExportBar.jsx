import React, { useState } from 'react';
import { downloadFile } from '../utils/postmanBuilder';
import styles from './ExportBar.module.css';

export default function ExportBar({ jsScript, collection, collectionName }) {
  const [tab, setTab] = useState('js');
  const [copied, setCopied] = useState(false);

  const content = tab === 'js' ? jsScript : JSON.stringify(collection, null, 2);
  const filename = (collectionName || 'postman-tests').replace(/\s+/g, '_');

  const copy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const download = () => {
    if (tab === 'js') {
      downloadFile(content, `${filename}.js`, 'text/javascript');
    } else {
      downloadFile(content, `${filename}.json`, 'application/json');
    }
  };

  return (
    <div className={styles.box}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'js' ? styles.tabActive : ''}`}
          onClick={() => setTab('js')}
        >
          Script JS
        </button>
        <button
          className={`${styles.tab} ${tab === 'collection' ? styles.tabActive : ''}`}
          onClick={() => setTab('collection')}
        >
          Collection Postman
        </button>
      </div>

      <div className={styles.header}>
        <span className={styles.hint}>
          {tab === 'js'
            ? 'Colle ce script dans l\'onglet "Tests" de chaque requête Postman.'
            : 'Importe ce fichier dans Postman via File → Import → Upload Files.'}
        </span>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={copy}>
            {copied ? 'Copié !' : 'Copier'}
          </button>
          <button
            className={`${styles.actionBtn} ${tab === 'js' ? styles.btnBlue : styles.btnGreen}`}
            onClick={download}
          >
            {tab === 'js' ? 'Télécharger .js' : 'Télécharger .json'}
          </button>
        </div>
      </div>

      <pre className={styles.code}>{content}</pre>
    </div>
  );
}
