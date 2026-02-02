import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

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

const CATEGORIES: ExpenseCategory[] = [
  'alimentacion', 'transporte', 'salud', 'entretenimiento',
  'servicios', 'compras', 'educacion', 'hogar', 'otros',
];

const CATEGORIES_EMOJI: Record<string, string> = {
  alimentacion: '🍔', transporte: '🚗', salud: '💊',
  entretenimiento: '🎬', servicios: '📱', compras: '🛍️',
  educacion: '📚', hogar: '🏠', otros: '📦',
};

// Mailgun sends form-urlencoded data
interface MailgunInbound {
  sender: string;
  from: string;
  subject: string;
  'body-plain': string;
  'body-html'?: string;
  recipient: string;
  timestamp: string;
  token: string;
  signature: string;
}

// Parse Interbank transaction email
async function parseInterbankEmail(subject: string, body: string): Promise<{
  amount: number;
  currency: string;
  merchant: string;
  category: ExpenseCategory;
  date: string;
  cardLast4?: string;
} | null> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extrae información de transacción bancaria de Interbank Perú. Responde SOLO JSON:
{"amount": number, "currency": "PEN|USD", "merchant": "string", "category": "alimentacion|transporte|salud|entretenimiento|servicios|compras|educacion|hogar|otros", "date": "YYYY-MM-DD", "cardLast4": "string|null"}

REGLAS:
- amount: monto de la transacción (número positivo)
- currency: PEN para soles, USD para dólares. Default: PEN
- merchant: nombre del comercio (capitalizado, limpio)
- category: categoriza según el comercio
- date: fecha de la transacción en formato YYYY-MM-DD
- cardLast4: últimos 4 dígitos de la tarjeta si aparece

CATEGORÍAS:
- alimentacion: restaurantes, supermercados, delivery (Wong, Metro, Plaza Vea, Tottus, Tambo, Rappi, PedidosYa)
- transporte: uber, taxi, combustible, peajes, estacionamiento
- salud: farmacias (Inkafarma, Mifarma), clínicas, hospitales
- entretenimiento: cine (Cineplanet, Cinemark), streaming, bares, discotecas
- servicios: luz (Enel, Luz del Sur), agua (Sedapal), internet, telefonía, peluquerías
- compras: tiendas (Saga, Ripley, Oechsle), Amazon, MercadoLibre
- educacion: universidades, institutos, cursos
- hogar: alquiler, mantenimiento, decoración
- otros: si no encaja

Si no es una notificación de transacción válida, responde: null

Ejemplos de emails de Interbank:
- "Consumo aprobado por S/ 45.90 en WONG CENCOSUD..." → {"amount": 45.90, "currency": "PEN", "merchant": "Wong", ...}
- "Pago con tu tarjeta ****1234 por S/ 25.00 en UBER*TRIP..." → {"amount": 25.00, "currency": "PEN", "merchant": "Uber", "cardLast4": "1234", ...}`,
        },
        {
          role: 'user',
          content: `Asunto: ${subject}\n\nCuerpo:\n${body}`,
        },
      ],
      max_tokens: 200,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content?.trim() || 'null';
    console.log('🤖 Parse email AI response:', content);

    if (content === 'null') {
      return null;
    }

    const result = JSON.parse(content);

    if (!result || !result.amount || result.amount <= 0) {
      return null;
    }

    return {
      amount: result.amount,
      currency: result.currency || 'PEN',
      merchant: result.merchant || 'Interbank',
      category: CATEGORIES.includes(result.category) ? result.category : 'otros',
      date: result.date || new Date().toISOString().split('T')[0],
      cardLast4: result.cardLast4 || undefined,
    };
  } catch (err) {
    console.error('Parse email error:', err);
    return null;
  }
}

// Get user by email
async function getUserByEmail(email: string) {
  // First check if this email is linked to a user
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('notification_email', email)
    .single();

  return data;
}

// Get user by recipient email (gastos+userid@domain.com format)
async function getUserByRecipientEmail(recipient: string) {
  // Extract user identifier from email like "gastos+123456@domain.com"
  const match = recipient.match(/gastos\+(\d+)@/i);
  if (!match) {
    console.log('❌ No telegram ID found in recipient:', recipient);
    return null;
  }

  const telegramId = match[1];
  console.log('🔍 Looking for user with telegram_id:', telegramId);

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error) {
    console.log('❌ Supabase error:', error.message);
  }

  console.log('👤 User lookup result:', data ? 'found' : 'not found');
  return data;
}

// Save expense
async function saveExpense(expense: Record<string, unknown>) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) throw error;
  return data;
}

// Check for duplicate
async function checkDuplicate(expense: { user_phone: string; merchant: string; amount: number; date: string }) {
  const { data } = await supabase
    .from('expenses')
    .select('id')
    .eq('user_phone', expense.user_phone)
    .eq('merchant', expense.merchant)
    .eq('amount', expense.amount)
    .eq('date', expense.date)
    .single();

  return data;
}

// Send Telegram notification
async function sendTelegramNotification(telegramId: string, message: string) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
      }),
    });
  } catch (err) {
    console.error('Telegram notification error:', err);
  }
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('📧 Email webhook:', req.method, new Date().toISOString());

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      endpoint: 'email',
      time: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Mailgun sends form-urlencoded or multipart/form-data
    const body = req.body as MailgunInbound;

    console.log('📥 Email received:');
    console.log('  From:', body.from || body.sender);
    console.log('  To:', body.recipient);
    console.log('  Subject:', body.subject);

    // Verify it's from Interbank
    const sender = (body.from || body.sender || '').toLowerCase();
    const subject = body.subject || '';
    const emailBody = body['body-plain'] || '';

    // Only process Interbank emails
    if (!sender.includes('interbank') && !subject.toLowerCase().includes('interbank')) {
      console.log('⏭️ Not an Interbank email, skipping');
      return res.status(200).json({ status: 'skipped', reason: 'not_interbank' });
    }

    // Find the user
    // Option 1: by recipient email (gastos+telegramId@domain.com)
    let user = await getUserByRecipientEmail(body.recipient);

    // Option 2: by sender's registered notification email
    if (!user) {
      user = await getUserByEmail(body.from || body.sender);
    }

    if (!user) {
      console.log('❌ No user found for this email');
      return res.status(200).json({ status: 'skipped', reason: 'no_user' });
    }

    console.log('👤 User found:', user.telegram_id, user.name);

    // Parse the transaction
    const transaction = await parseInterbankEmail(subject, emailBody);

    if (!transaction) {
      console.log('❌ Could not parse transaction from email');
      return res.status(200).json({ status: 'skipped', reason: 'not_transaction' });
    }

    console.log('💰 Transaction parsed:', transaction);

    const userPhone = `telegram:${user.telegram_id}`;

    // Check for duplicates
    const duplicate = await checkDuplicate({
      user_phone: userPhone,
      merchant: transaction.merchant,
      amount: transaction.amount,
      date: transaction.date,
    });

    if (duplicate) {
      console.log('⏭️ Duplicate transaction, skipping');
      return res.status(200).json({ status: 'skipped', reason: 'duplicate' });
    }

    // Save the expense
    const expense = await saveExpense({
      user_phone: userPhone,
      amount: transaction.amount,
      currency: transaction.currency,
      category: transaction.category,
      merchant: transaction.merchant,
      description: transaction.cardLast4 ? `Tarjeta ****${transaction.cardLast4}` : 'Interbank email',
      date: transaction.date,
    });

    console.log('✅ Expense saved:', expense.id);

    // Notify user via Telegram
    const emoji = CATEGORIES_EMOJI[expense.category] || '📦';
    await sendTelegramNotification(
      user.telegram_id,
      `📧 ${emoji} Gasto automático registrado\n\n` +
      `💰 S/ ${expense.amount.toLocaleString()} ${expense.currency}\n` +
      `🏪 ${expense.merchant}\n` +
      `📁 ${expense.category}\n` +
      `📅 ${expense.date}\n\n` +
      `💳 Detectado desde tu email de Interbank`
    );

    return res.status(200).json({
      status: 'ok',
      expense_id: expense.id,
      amount: expense.amount,
      merchant: expense.merchant,
    });

  } catch (err) {
    console.error('❌ Email handler error:', err);
    return res.status(500).json({ error: 'Internal server error', details: String(err) });
  }
}
