import 'dotenv/config';
import express from 'express';
import webhookRouter from './routes/webhook.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'PagosWA',
    version: '1.0.0',
  });
});

// Routes
app.use('/', webhookRouter);

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 PagosWA está corriendo en puerto ${PORT}

📱 Webhook URL: http://localhost:${PORT}/webhook

Para configurar en producción:
1. Despliega en un servidor con HTTPS
2. Configura el webhook en Meta Developer Portal
3. Usa la URL: https://tu-dominio.com/webhook
  `);
});
