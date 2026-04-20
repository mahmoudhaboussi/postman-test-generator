# Postman Test Generator

Génère automatiquement des scripts de test JavaScript Postman depuis un cas de test (français ou Gherkin) et un contrat d'interface API.

## Stack

- **Frontend** : React + Vite
- **Backend** : Node.js + Express
- **IA** : Anthropic Claude (claude-sonnet)

## Structure

```
postman-test-generator/
├── client/               # React + Vite
│   └── src/
│       ├── components/   # TestCaseForm, EndpointCard, ExportBar
│       ├── services/     # Appels au backend
│       └── utils/        # Constructeur collection Postman
├── server/               # Node.js + Express
│   ├── routes/           # POST /api/generate/single & /collection
│   └── services/         # Client Anthropic
└── package.json          # Scripts racine
```

## Installation

### 1. Cloner et installer les dépendances

```bash
# Dépendances racine (concurrently)
npm install

# Backend
cd server && npm install && cd ..

# Frontend
cd client && npm install && cd ..
```

### 2. Configurer la clé API

```bash
cp server/.env.example server/.env
# Édite server/.env et remplace ta_clé_ici par ta clé Anthropic
```

### 3. Lancer le projet

```bash
npm run dev
```

- Frontend : http://localhost:5173
- Backend  : http://localhost:3001

## Utilisation

1. Décris ton cas de test en **français** ou en **Gherkin**
2. Renseigne la **Base URL** et le **nom** de ta collection
3. Ajoute tes **endpoints** (méthode, chemin, body, réponses attendues, headers)
4. Indique les **variables à extraire** pour chaîner les appels (ex: token → étape suivante)
5. **Prévisualise** chaque endpoint individuellement
6. **Assemble** le script complet
7. **Exporte** en `.js` (onglet Tests Postman) ou en `.json` (collection importable)

## Export

| Format | Usage |
|--------|-------|
| `.js`  | Coller dans l'onglet "Tests" de chaque requête Postman |
| `.json` | Importer directement via File → Import → Upload Files |
