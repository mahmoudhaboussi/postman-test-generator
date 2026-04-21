require('dotenv').config();
const express = require('express');
const cors = require('cors');
const generateRoute = require('./routes/generate');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use('/api', generateRoute);

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Postman Test Generator API' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});