import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import twilio from 'twilio';

// Types
interface TwilioWebhookBody {
  From: string;
  To: string;
  Body?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  NumMedia?: string;
  MessageSid: string;
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
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

const CATEGORIES: ExpenseCategory[] = [
  'alimentacion', 'transporte', 'salud', 'entretenimiento',
  'servicios', 'compras', 'educacion', 'hogar', 'otros',
];

const CATEGORIES_EMOJI: Record<string, string> = {
  alimentacion: '🍔', transporte: '🚗', salud: '💊',
  entretenimiento: '🎬', servicios: '📱', compras: '🛍️',
  educacion: '📚', hogar: '🏠', otros: '📦',
};

// Simple in-memory deduplication
const processedMessages = new Set<string>();
function isProcessed(messageId: string): boolean {
  if (processedMessages.has(messageId)) return true;
  processedMessages.add(messageId);
  setTimeout(() => processedMessages.delete(messageId), 5 * 60 * 1000);
  return false;
}

// Store pending duplicate data per user (to handle "si" response)
interface PendingExpense {
  duplicateId: string;
  newData: Record<string, unknown>;
  expiresAt: number;
}
const pendingDuplicates = new Map<string, PendingExpense>();

function setPendingDuplicate(userPhone: string, duplicateId: string, newData: Record<string, unknown>) {
  pendingDuplicates.set(userPhone, {
    duplicateId,
    newData,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}

function getPendingDuplicate(userPhone: string): PendingExpense | null {
  const pending = pendingDuplicates.get(userPhone);
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    pendingDuplicates.delete(userPhone);
    return null;
  }
  return pending;
}

function clearPendingDuplicate(userPhone: string) {
  pendingDuplicates.delete(userPhone);
}

const HELP_MESSAGE = `🤖 *PagosWA - Tu asistente de gastos*

📸 *Envía una foto* de tu factura o boleta y la registraré.

📝 *Comandos:*
• *resumen* - Últimos gastos
• *mes* - Gastos del mes
• *categorias* - Por categoría
• *borrar* - Eliminar último gasto
• *moneda COP* - Cambiar moneda (COP/CLP/USD/PEN)
• *ayuda* - Este mensaje`;

// Twilio helpers
async function sendMessage(to: string, text: string) {
  await twilioClient.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to: to,
    body: text,
  });
}

async function getMediaAsBase64(mediaUrl: string) {
  console.log('📥 Fetching media from:', mediaUrl);

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString('base64')}`,
    },
  });

  console.log('📥 Media response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Media fetch failed:', errorText);
    throw new Error(`Failed to fetch media: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  console.log('📥 Media content-type:', contentType);

  // Check if we got an image
  if (!contentType.startsWith('image/')) {
    const text = await response.text();
    console.error('❌ Not an image, got:', text.substring(0, 200));
    throw new Error('Media is not an image');
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  console.log('✅ Media downloaded, size:', base64.length, 'chars');

  return { base64, mimeType: contentType };
}

// OpenAI Vision
async function analyzeImage(base64: string, mimeType: string, preferredCurrency: string | null) {
  console.log('🤖 Calling OpenAI with image size:', base64.length, 'chars, type:', mimeType, 'preferred currency:', preferredCurrency);

  const currencyHint = preferredCurrency
    ? `\n\nIMPORTANTE: Este usuario normalmente registra gastos en ${preferredCurrency}. Si no hay evidencia clara de otra moneda, usa ${preferredCurrency}.`
    : '';

  let response;
  try {
    response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Extrae info de comprobantes de pago. Responde SOLO JSON:
{"amount": number, "currency": "COP|CLP|USD|PEN|MXN|ARS|EUR", "category": "${CATEGORIES.join('|')}", "merchant": "string", "description": "string|null", "date": "YYYY-MM-DD", "confidence": 0.0-1.0}

REGLAS CRÍTICAS para detectar moneda:
1. Si menciona Bogotá, Colombia, NIT, Cámara de Comercio → SIEMPRE es COP (pesos colombianos)
2. Si menciona Santiago, Chile, RUT, SII, boleta electrónica → CLP
3. Si menciona Lima, Perú, RUC, SUNAT, S/. → PEN
4. Si menciona México, RFC, SAT → MXN
5. Si el símbolo es $ sin más contexto y el monto es >1000, probablemente es COP o CLP (NO USD)
6. USD solo si dice explícitamente "USD", "dollars", o es un recibo de USA

Prioridad: Contexto geográfico > Símbolo de moneda${currencyHint}

Si no es un comprobante: {"error": "mensaje"}`,
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: 'Extrae la información del comprobante.' },
          ],
        },
      ],
      max_tokens: 300,
    });
  } catch (openaiErr) {
    console.error('❌ OpenAI API error:', openaiErr);
    throw new Error(`OpenAI error: ${openaiErr instanceof Error ? openaiErr.message : String(openaiErr)}`);
  }

  let content = response.choices[0]?.message?.content || '{}';
  console.log('📝 Raw OpenAI content:', content);

  content = content.trim();
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    content = jsonMatch[1].trim();
  }
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\s*/, '');
  }

  console.log('📝 Cleaned content:', content);

  try {
    return JSON.parse(content);
  } catch (parseErr) {
    console.error('❌ JSON parse error. Content was:', content);
    throw new Error(`No pude entender la respuesta de OpenAI: ${content.substring(0, 100)}`);
  }
}

// Database
async function getOrCreateUser(phone: string) {
  const cleanPhone = phone.replace('whatsapp:', '');
  const { data } = await supabase.from('users').select().eq('phone', cleanPhone).single();
  if (data) return data;

  await supabase.from('users').insert({ phone: cleanPhone });
  return { phone: cleanPhone };
}

async function checkDuplicate(expense: { user_phone: string; merchant: string; amount: number; date: string }) {
  const { data } = await supabase
    .from('expenses')
    .select('id, merchant, amount, date, created_at')
    .eq('user_phone', expense.user_phone)
    .eq('merchant', expense.merchant)
    .eq('amount', expense.amount)
    .eq('date', expense.date)
    .single();

  return data;
}

async function saveExpense(expense: Record<string, unknown>) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) throw error;
  return data;
}

async function deleteExpense(id: string, userPhone: string) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_phone', userPhone);

  if (error) throw error;
  return true;
}

async function updateExpenseCurrency(id: string, userPhone: string, currency: string) {
  const { error } = await supabase
    .from('expenses')
    .update({ currency })
    .eq('id', id)
    .eq('user_phone', userPhone);

  if (error) throw error;
  return true;
}

async function getLastExpense(userPhone: string) {
  const { data } = await supabase
    .from('expenses')
    .select()
    .eq('user_phone', userPhone)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

async function getUserPreferredCurrency(userPhone: string): Promise<string | null> {
  // Get last 10 expenses to determine user's most common currency
  const { data } = await supabase
    .from('expenses')
    .select('currency')
    .eq('user_phone', userPhone)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) return null;

  // Count currencies
  const counts: Record<string, number> = {};
  for (const e of data) {
    counts[e.currency] = (counts[e.currency] || 0) + 1;
  }

  // Return most common if it's >60% of transactions
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topCurrency, topCount] = sorted[0];

  if (topCount / data.length >= 0.6) {
    return topCurrency;
  }

  return null;
}

async function getMonthlyExpenses(phone: string) {
  const cleanPhone = phone.replace('whatsapp:', '');
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data } = await supabase
    .from('expenses')
    .select()
    .eq('user_phone', cleanPhone)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });

  return data || [];
}

// Message handlers
async function handleImage(from: string, mediaUrl: string) {
  const cleanPhone = from.replace('whatsapp:', '');
  console.log('🚀 handleImage START for', cleanPhone);

  async function trySendMessage(text: string) {
    try {
      await sendMessage(from, text);
      console.log('✅ Message sent');
    } catch (sendErr) {
      console.error('⚠️ Could not send message:', sendErr);
    }
  }

  try {
    await trySendMessage('⏳ Analizando tu comprobante...');

    // Get user's preferred currency based on history
    const preferredCurrency = await getUserPreferredCurrency(cleanPhone);
    console.log('💱 User preferred currency:', preferredCurrency);

    console.log('📥 Downloading image from:', mediaUrl);
    const { base64, mimeType } = await getMediaAsBase64(mediaUrl);
    console.log('✅ Image downloaded, size:', base64.length, 'bytes');

    console.log('🤖 Calling OpenAI...');
    const data = await analyzeImage(base64, mimeType, preferredCurrency);
    console.log('✅ OpenAI response:', JSON.stringify(data));

    if (data.error) {
      const errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      throw new Error(errMsg);
    }

    // Check for duplicates
    const expenseData = {
      user_phone: cleanPhone,
      amount: data.amount,
      currency: data.currency || 'CLP',
      category: CATEGORIES.includes(data.category) ? data.category : 'otros',
      merchant: data.merchant,
      description: data.description,
      date: data.date,
    };

    const duplicate = await checkDuplicate({
      user_phone: cleanPhone,
      merchant: data.merchant,
      amount: data.amount,
      date: data.date,
    });

    if (duplicate) {
      // Save pending state so user can confirm
      setPendingDuplicate(cleanPhone, duplicate.id, expenseData);

      await trySendMessage(
        `⚠️ *Gasto duplicado detectado*\n\n` +
        `Ya tienes un gasto de $${data.amount.toLocaleString()} en ${data.merchant} el ${data.date}.\n\n` +
        `Escribe *"si"* para reemplazar el anterior, o ignora este mensaje.`
      );
      return;
    }

    console.log('💾 Saving to Supabase...');
    const expense = await saveExpense(expenseData);
    console.log('✅ Saved expense:', expense.id);

    const emoji = CATEGORIES_EMOJI[expense.category] || '📦';
    await trySendMessage(
      `✅ ${emoji} *Gasto registrado*\n\n💰 $${expense.amount.toLocaleString()} ${expense.currency}\n🏪 ${expense.merchant}\n📁 ${expense.category}\n📅 ${expense.date}`
    );
  } catch (err) {
    let errorMessage: string;
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    } else {
      errorMessage = JSON.stringify(err);
    }
    console.error('❌ handleImage error:', errorMessage);
    console.error('❌ Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    await trySendMessage(`❌ Error: ${errorMessage}`);
  }
}

async function handleText(from: string, text: string) {
  const cleanPhone = from.replace('whatsapp:', '');
  const lowerText = text.toLowerCase().trim();

  // Check for pending duplicate confirmation
  if (['si', 'sí', 'yes', 'ok'].includes(lowerText)) {
    const pending = getPendingDuplicate(cleanPhone);
    if (pending) {
      // Delete the old duplicate and save the new one
      await deleteExpense(pending.duplicateId, cleanPhone);
      const expense = await saveExpense(pending.newData);
      clearPendingDuplicate(cleanPhone);

      const emoji = CATEGORIES_EMOJI[expense.category as string] || '📦';
      await sendMessage(
        from,
        `✅ ${emoji} *Gasto actualizado*\n\n💰 $${Number(expense.amount).toLocaleString()} ${expense.currency}\n🏪 ${expense.merchant}\n📁 ${expense.category}\n📅 ${expense.date}`
      );
      return;
    }
  }

  if (['ayuda', 'help', 'hola', 'hi'].includes(lowerText)) {
    await sendMessage(from, HELP_MESSAGE);
    return;
  }

  if (lowerText === 'mes' || lowerText === 'resumen') {
    const expenses = await getMonthlyExpenses(from);
    if (!expenses.length) {
      await sendMessage(from, '📭 No tienes gastos este mes.');
      return;
    }

    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    let msg = `📅 *Gastos del mes*\n\n`;
    for (const e of expenses.slice(0, 8)) {
      msg += `${CATEGORIES_EMOJI[e.category] || '📦'} $${Number(e.amount).toLocaleString()} - ${e.merchant}\n`;
    }
    msg += `\n💰 *Total:* $${total.toLocaleString()}`;
    await sendMessage(from, msg);
    return;
  }

  if (lowerText === 'categorias') {
    const expenses = await getMonthlyExpenses(from);
    if (!expenses.length) {
      await sendMessage(from, '📭 No tienes gastos este mes.');
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
    await sendMessage(from, msg);
    return;
  }

  if (lowerText === 'borrar' || lowerText === 'eliminar') {
    const lastExpense = await getLastExpense(cleanPhone);
    if (!lastExpense) {
      await sendMessage(from, '📭 No tienes gastos para borrar.');
      return;
    }

    await deleteExpense(lastExpense.id, cleanPhone);
    await sendMessage(
      from,
      `🗑️ *Gasto eliminado*\n\n` +
      `Se borró: $${Number(lastExpense.amount).toLocaleString()} en ${lastExpense.merchant} (${lastExpense.date})`
    );
    return;
  }

  // Change currency command: "moneda COP" or "cambiar COP"
  const currencyMatch = lowerText.match(/^(?:moneda|cambiar|currency)\s+(cop|clp|usd|pen|mxn|ars|eur)$/i);
  if (currencyMatch) {
    const newCurrency = currencyMatch[1].toUpperCase();
    const lastExpense = await getLastExpense(cleanPhone);

    if (!lastExpense) {
      await sendMessage(from, '📭 No tienes gastos para modificar.');
      return;
    }

    await updateExpenseCurrency(lastExpense.id, cleanPhone, newCurrency);
    await sendMessage(
      from,
      `💱 *Moneda actualizada*\n\n` +
      `${lastExpense.merchant}: $${Number(lastExpense.amount).toLocaleString()} ${lastExpense.currency} → ${newCurrency}`
    );
    return;
  }

  await sendMessage(from, '🤔 No entendí. Escribe *ayuda* o envía una foto de tu comprobante.');
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🔔 Webhook called:', req.method, new Date().toISOString());

  // Debug endpoint
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      provider: 'twilio',
      time: new Date().toISOString(),
      env: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
        hasTwilioToken: !!process.env.TWILIO_AUTH_TOKEN,
      }
    });
  }

  // Twilio webhook (POST)
  if (req.method === 'POST') {
    const body = req.body as TwilioWebhookBody;
    console.log('📥 Twilio POST received:', JSON.stringify(body, null, 2));

    const { From, Body, MediaUrl0, MessageSid, NumMedia } = body;

    if (!From || !MessageSid) {
      console.log('❌ Missing required fields');
      return res.status(200).send('<Response></Response>');
    }

    // Deduplication
    if (isProcessed(MessageSid)) {
      console.log(`⏭️ Skipping duplicate: ${MessageSid}`);
      return res.status(200).send('<Response></Response>');
    }

    try {
      await getOrCreateUser(From);

      const hasMedia = NumMedia && parseInt(NumMedia) > 0 && MediaUrl0;

      if (hasMedia) {
        console.log('🖼️ Handling image');
        await handleImage(From, MediaUrl0!);
      } else if (Body) {
        console.log(`💬 Handling text: ${Body}`);
        await handleText(From, Body);
      }

      console.log('✅ Webhook processed successfully');
    } catch (err) {
      console.error('❌ Webhook error:', err);
    }

    // Twilio expects TwiML response (empty is fine)
    return res.status(200).send('<Response></Response>');
  }

  return res.status(405).send('Method not allowed');
}
