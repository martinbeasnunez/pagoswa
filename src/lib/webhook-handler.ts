import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { WhatsAppWebhookBody, WhatsAppMessage } from '../types/index.js';
import * as whatsapp from '../services/whatsapp.js';
import * as openai from '../services/openai.js';
import * as db from '../services/supabase.js';

const CATEGORIES_EMOJI: Record<string, string> = {
  alimentacion: '🍔',
  transporte: '🚗',
  salud: '💊',
  entretenimiento: '🎬',
  servicios: '📱',
  compras: '🛍️',
  educacion: '📚',
  hogar: '🏠',
  otros: '📦',
};

const HELP_MESSAGE = `🤖 *PagosWA - Tu asistente de gastos*

📸 *Envía una foto* de tu factura, boleta o comprobante y lo registraré automáticamente.

📝 *Comandos disponibles:*
• *resumen* - Ver resumen de gastos recientes
• *mes* - Ver gastos del mes actual
• *categorias* - Ver gastos por categoría
• *ayuda* - Mostrar este mensaje

💡 *Tip:* Puedes escribir los comandos con o sin mayúsculas.`;

export function verifyWebhook(req: VercelRequest, res: VercelResponse) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verificado');
    return res.status(200).send(challenge);
  }

  console.log('❌ Verificación fallida');
  return res.status(403).send('Forbidden');
}

export async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  const body = req.body as WhatsAppWebhookBody;

  if (body.object !== 'whatsapp_business_account') {
    return res.status(404).send('Not found');
  }

  // Responder inmediatamente
  res.status(200).send('OK');

  // Procesar mensajes
  try {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const messages = change.value.messages;
        if (messages && messages.length > 0) {
          for (const message of messages) {
            await processMessage(message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error procesando webhook:', error);
  }
}

async function processMessage(message: WhatsAppMessage): Promise<void> {
  const userPhone = message.from;
  console.log(`📨 Mensaje de ${userPhone}: ${message.type}`);

  try {
    await db.getOrCreateUser(userPhone);

    if (message.type === 'image' && message.image) {
      await handleImage(message);
    } else if (message.type === 'text' && message.text) {
      await handleText(message);
    } else {
      await whatsapp.sendMessage(userPhone, '❓ Envía una foto de tu comprobante o escribe "ayuda".');
    }
  } catch (error) {
    console.error('Error:', error);
    await whatsapp.sendMessage(userPhone, '❌ Error procesando tu mensaje. Intenta de nuevo.');
  }
}

async function handleImage(message: WhatsAppMessage): Promise<void> {
  const userPhone = message.from;

  await whatsapp.sendReaction(userPhone, message.id, '⏳');

  try {
    const { base64, mimeType } = await whatsapp.getMediaAsBase64(message.image!.id);
    const expenseData = await openai.analyzeExpenseImage(base64, mimeType);

    const expense = await db.saveExpense({
      user_phone: userPhone,
      amount: expenseData.amount,
      currency: expenseData.currency,
      category: expenseData.category,
      merchant: expenseData.merchant,
      description: expenseData.description,
      date: expenseData.date,
      image_url: null,
      raw_text: null,
    });

    await whatsapp.sendReaction(userPhone, message.id, '✅');

    const emoji = CATEGORIES_EMOJI[expense.category] || '📦';
    await whatsapp.sendMessage(userPhone, `${emoji} *Gasto registrado*

💰 *Monto:* $${expense.amount.toLocaleString()} ${expense.currency}
🏪 *Comercio:* ${expense.merchant}
📁 *Categoría:* ${expense.category}
📅 *Fecha:* ${expense.date}
${expense.description ? `📝 *Descripción:* ${expense.description}` : ''}

_Confianza: ${Math.round(expenseData.confidence * 100)}%_`);
  } catch (error) {
    await whatsapp.sendReaction(userPhone, message.id, '❌');
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    await whatsapp.sendMessage(userPhone, `❌ No pude procesar: ${msg}`);
  }
}

async function handleText(message: WhatsAppMessage): Promise<void> {
  const userPhone = message.from;
  const text = message.text?.body?.toLowerCase().trim() || '';

  if (text === 'ayuda' || text === 'help' || text === 'hola') {
    await whatsapp.sendMessage(userPhone, HELP_MESSAGE);
    return;
  }

  if (text === 'resumen') {
    const expenses = await db.getExpensesByUser(userPhone, 10);
    if (expenses.length === 0) {
      await whatsapp.sendMessage(userPhone, '📭 No tienes gastos. ¡Envía tu primer comprobante!');
      return;
    }
    const report = await openai.generateExpenseReport(expenses.map(e => ({
      category: e.category, amount: e.amount, merchant: e.merchant, date: e.date
    })));
    await whatsapp.sendMessage(userPhone, `📊 *Resumen*\n\n${report}`);
    return;
  }

  if (text === 'mes') {
    const now = new Date();
    const expenses = await db.getMonthlyExpenses(userPhone, now.getFullYear(), now.getMonth() + 1);
    if (expenses.length === 0) {
      await whatsapp.sendMessage(userPhone, '📭 No tienes gastos este mes.');
      return;
    }
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    let msg = `📅 *Gastos del mes*\n\n`;
    for (const e of expenses.slice(0, 10)) {
      msg += `${CATEGORIES_EMOJI[e.category] || '📦'} $${e.amount.toLocaleString()} - ${e.merchant}\n`;
    }
    msg += `\n💰 *Total:* $${total.toLocaleString()}`;
    await whatsapp.sendMessage(userPhone, msg);
    return;
  }

  if (text === 'categorias') {
    const now = new Date();
    const byCategory = await db.getExpensesByCategory(userPhone, now.getFullYear(), now.getMonth() + 1);
    if (Object.keys(byCategory).length === 0) {
      await whatsapp.sendMessage(userPhone, '📭 No tienes gastos este mes.');
      return;
    }
    let msg = `📊 *Por categoría*\n\n`;
    let total = 0;
    for (const [cat, data] of Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)) {
      msg += `${CATEGORIES_EMOJI[cat] || '📦'} *${cat}*: $${data.total.toLocaleString()}\n`;
      total += data.total;
    }
    msg += `\n💰 *Total:* $${total.toLocaleString()}`;
    await whatsapp.sendMessage(userPhone, msg);
    return;
  }

  await whatsapp.sendMessage(userPhone, '🤔 No entendí. Escribe *ayuda* o envía una foto de tu comprobante.');
}
