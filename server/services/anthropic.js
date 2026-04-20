const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250514',
  'claude-haiku-4-5',
  'claude-sonnet-4-5',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
];

async function generateScript(prompt) {
  let lastError;
  for (const model of MODELS) {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });
      console.log(`OK Modele utilise : ${model}`);
      const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      return text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
    } catch (err) {
      console.log(`ECHEC ${model} : ${err.message.substring(0, 120)}`);
      lastError = err;
    }
  }
  throw new Error(`Aucun modele disponible. Derniere erreur : ${lastError.message}`);
}

module.exports = { generateScript };