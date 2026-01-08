import { Router, Request, Response } from 'express';
import type { WhatsAppWebhookBody } from '../types/index.js';
import { handleMessage } from '../services/bot.js';

const router = Router();

// Verificación del webhook (GET)
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verificado correctamente');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Verificación de webhook fallida');
    res.sendStatus(403);
  }
});

// Recepción de mensajes (POST)
router.post('/webhook', async (req: Request, res: Response) => {
  const body = req.body as WhatsAppWebhookBody;

  // Verificar que es un webhook de WhatsApp
  if (body.object !== 'whatsapp_business_account') {
    res.sendStatus(404);
    return;
  }

  // Responder inmediatamente para evitar reintentos
  res.sendStatus(200);

  // Procesar mensajes en background
  try {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const messages = change.value.messages;

        if (messages && messages.length > 0) {
          for (const message of messages) {
            console.log(`📨 Mensaje recibido de ${message.from}: ${message.type}`);

            // Procesar cada mensaje
            handleMessage(message).catch((error) => {
              console.error('Error procesando mensaje:', error);
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error en webhook:', error);
  }
});

export default router;
