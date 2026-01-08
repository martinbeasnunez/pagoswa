import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';

// Types
interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document';
  text?: { body: string };
  image?: { id: string; mime_type: string };
}

interface WhatsAppWebhookBody {
  object: string;
  entry: Array<{
    changes: Array<{
      value: {
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
}

type ExpenseCategory =
  | 'alimentacion'
  | 'transporte'
  | 'salud'
  | 'entretenimiento'
  | 'servicios'
  | 'compras'
  | 'educacion'
  | 'hogar'
  | 'otros';

// Clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const WHATSAPP_API = 'https://graph.facebook.com/v18.0';
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const waToken = process.env.WHATSAPP_TOKEN!;

const CATEGORIES: ExpenseCategory[] = [
  'alimentacion', 'transporte', 'salud', 'entretenimiento',
  'servicios', 'compras', 'educacion', 'hogar', 'otros',
];

const CATEGORIES_EMOJI: Record<string, string> = {
  alimentacion: '🍔', transporte: '🚗', salud: '💊',
  entretenimiento: '🎬', servicios: '📱', compras: '🛍️',
  educacion: '📚', hogar: '🏠', otros: '📦',
};

const HELP_MESSAGE = `🤖 *PagosWA - Tu asistente de gastos*

📸 *Envía una foto* de tu factura o boleta y la registraré.

📝 *Comandos:*
• *resumen* - Últimos gastos
• *mes* - Gastos del mes
• *categorias* - Por categoría
• *ayuda* - Este mensaje`;

// WhatsApp helpers
async function sendMessage(to: string, text: string) {
  await axios.post(
    `${WHATSAPP_API}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    { headers: { Authorization: `Bearer ${waToken}` } }
  );
}

async function sendReaction(to: string, messageId: string, emoji: string) {
  await axios.post(
    `${WHATSAPP_API}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'reaction',
      reaction: { message_id: messageId, emoji },
    },
    { headers: { Authorization: `Bearer ${waToken}` } }
  );
}

async function getMediaAsBase64(mediaId: string) {
  const metaRes = await axios.get(`${WHATSAPP_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${waToken}` },
  });
  const { url, mime_type } = metaRes.data;

  const mediaRes = await axios.get(url, {
    headers: { Authorization: `Bearer ${waToken}` },
    responseType: 'arraybuffer',
  });

  return {
    base64: Buffer.from(mediaRes.data).toString('base64'),
    mimeType: mime_type,
  };
}

// OpenAI Vision
async function analyzeImage(base64: string, mimeType: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Extrae info de comprobantes de pago. Responde SOLO JSON:
{"amount": number, "currency": "CLP", "category": "${CATEGORIES.join('|')}", "merchant": "string", "description": "string|null", "date": "YYYY-MM-DD", "confidence": 0.0-1.0}
Si no es un comprobante: {"error": "mensaje"}`,
      },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: 'Extrae la información.' },
        ],
      },
    ],
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content || '{}';
  return JSON.parse(content);
}

// Database
async function getOrCreateUser(phone: string) {
  const { data } = await supabase.from('users').select().eq('phone', phone).single();
  if (data) return data;

  await supabase.from('users').insert({ phone });
  return { phone };
}

async function saveExpense(expense: Record<string, unknown>) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) throw error;
  return data;
}

async function getMonthlyExpenses(phone: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data } = await supabase
    .from('expenses')
    .select()
    .eq('user_phone', phone)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });

  return data || [];
}

// Message handlers
async function handleImage(msg: WhatsAppMessage) {
  const phone = msg.from;
  await sendReaction(phone, msg.id, '⏳');

  try {
    const { base64, mimeType } = await getMediaAsBase64(msg.image!.id);
    const data = await analyzeImage(base64, mimeType);

    if (data.error) throw new Error(data.error);

    const expense = await saveExpense({
      user_phone: phone,
      amount: data.amount,
      currency: data.currency || 'CLP',
      category: CATEGORIES.includes(data.category) ? data.category : 'otros',
      merchant: data.merchant,
      description: data.description,
      date: data.date,
    });

    await sendReaction(phone, msg.id, '✅');

    const emoji = CATEGORIES_EMOJI[expense.category] || '📦';
    await sendMessage(phone,
      `${emoji} *Gasto registrado*\n\n💰 $${expense.amount.toLocaleString()} ${expense.currency}\n🏪 ${expense.merchant}\n📁 ${expense.category}\n📅 ${expense.date}`
    );
  } catch (err) {
    await sendReaction(phone, msg.id, '❌');
    await sendMessage(phone, `❌ Error: ${err instanceof Error ? err.message : 'No pude procesar la imagen'}`);
  }
}

async function handleText(msg: WhatsAppMessage) {
  const phone = msg.from;
  const text = msg.text?.body?.toLowerCase().trim() || '';

  if (['ayuda', 'help', 'hola', 'hi'].includes(text)) {
    await sendMessage(phone, HELP_MESSAGE);
    return;
  }

  if (text === 'mes' || text === 'resumen') {
    const expenses = await getMonthlyExpenses(phone);
    if (!expenses.length) {
      await sendMessage(phone, '📭 No tienes gastos este mes.');
      return;
    }

    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    let msg = `📅 *Gastos del mes*\n\n`;
    for (const e of expenses.slice(0, 8)) {
      msg += `${CATEGORIES_EMOJI[e.category] || '📦'} $${Number(e.amount).toLocaleString()} - ${e.merchant}\n`;
    }
    msg += `\n💰 *Total:* $${total.toLocaleString()}`;
    await sendMessage(phone, msg);
    return;
  }

  if (text === 'categorias') {
    const expenses = await getMonthlyExpenses(phone);
    if (!expenses.length) {
      await sendMessage(phone, '📭 No tienes gastos este mes.');
      return;
    }

    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    }

    let msg = `📊 *Gastos por categoría*\n\n`;
    for (const [cat, total] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      msg += `${CATEGORIES_EMOJI[cat] || '📦'} *${cat}*: $${total.toLocaleString()}\n`;
    }
    await sendMessage(phone, msg);
    return;
  }

  await sendMessage(phone, '🤔 No entendí. Escribe *ayuda* o envía una foto de tu comprobante.');
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Webhook verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('✅ Webhook verified');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // Message handling (POST)
  if (req.method === 'POST') {
    res.status(200).send('OK'); // Respond immediately

    const body = req.body as WhatsAppWebhookBody;
    if (body.object !== 'whatsapp_business_account') return;

    try {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const messages = change.value.messages || [];
          for (const msg of messages) {
            await getOrCreateUser(msg.from);

            if (msg.type === 'image' && msg.image) {
              await handleImage(msg);
            } else if (msg.type === 'text') {
              await handleText(msg);
            }
          }
        }
      }
    } catch (err) {
      console.error('Webhook error:', err);
    }
  }
}
