import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Types
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  voice?: TelegramVoice;
}

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
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

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

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
const processedMessages = new Set<number>();
function isProcessed(updateId: number): boolean {
  if (processedMessages.has(updateId)) return true;
  processedMessages.add(updateId);
  setTimeout(() => processedMessages.delete(updateId), 5 * 60 * 1000);
  return false;
}

// Store pending duplicate data per user
interface PendingExpense {
  duplicateId: string;
  newData: Record<string, unknown>;
  expiresAt: number;
}
const pendingDuplicates = new Map<string, PendingExpense>();

function setPendingDuplicate(chatId: string, duplicateId: string, newData: Record<string, unknown>) {
  pendingDuplicates.set(chatId, {
    duplicateId,
    newData,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
}

function getPendingDuplicate(chatId: string): PendingExpense | null {
  const pending = pendingDuplicates.get(chatId);
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    pendingDuplicates.delete(chatId);
    return null;
  }
  return pending;
}

function clearPendingDuplicate(chatId: string) {
  pendingDuplicates.delete(chatId);
}

const HELP_MESSAGE = `🤖 *PagosWA \\- Tu asistente de gastos*

📸 *Envía una foto* de tu factura o boleta y la registraré\\.

🎤 *Envía un audio* diciendo tu gasto \\(ej: "50 soles en uber"\\)

⚡ *Registro rápido:*
• "50 uber" \\- Registra S/50 en Uber
• "120 wong" \\- Registra S/120 en Wong
• "100 cop rappi" \\- Registra $100 COP

📝 *Comandos:*
• /resumen \\- Últimos gastos
• /mes \\- Gastos del mes
• /categorias \\- Por categoría
• /borrar \\- Eliminar último gasto
• /moneda COP \\- Cambiar moneda
• /vincular \\- Conectar con el dashboard
• /banco \\- Conectar notificaciones del banco
• /ayuda \\- Este mensaje`;

const DASHBOARD_URL = 'https://dashboard-nu-drab-32.vercel.app';

// Generate random 6-character code
function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create link code in database
async function createLinkCode(telegramId: string, firstName: string, username?: string): Promise<string> {
  // Delete any existing unused codes for this user
  await supabase
    .from('link_codes')
    .delete()
    .eq('telegram_id', telegramId)
    .eq('used', false);

  // Generate new code
  const code = generateLinkCode();

  // Insert new code
  const { error } = await supabase.from('link_codes').insert({
    code,
    telegram_id: telegramId,
    telegram_name: firstName,
    telegram_username: username,
  });

  if (error) {
    console.error('Error creating link code:', error);
    throw new Error('No se pudo generar el código');
  }

  return code;
}

// Telegram API helpers
async function sendMessage(chatId: number, text: string, parseMode: 'MarkdownV2' | 'HTML' | undefined = undefined) {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Telegram sendMessage error:', error);
    // Retry without parse mode if markdown failed
    if (parseMode) {
      return sendMessage(chatId, text.replace(/[_*\[\]()~`>#+=|{}.!\\-]/g, ''), undefined);
    }
  }
  return response;
}

async function sendChatAction(chatId: number, action: string = 'typing') {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

async function getFile(fileId: string): Promise<string> {
  const response = await fetch(`${TELEGRAM_API}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });

  const data = await response.json();
  if (!data.ok) throw new Error('Failed to get file path');

  return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${data.result.file_path}`;
}

async function downloadImageAsBase64(fileUrl: string) {
  console.log('📥 Downloading from:', fileUrl);

  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error('Failed to download image');

  let contentType = response.headers.get('content-type') || 'image/jpeg';

  // Normalize MIME type - OpenAI only accepts specific image types
  // Force to image/jpeg or image/png based on file extension or content
  if (!contentType.startsWith('image/') ||
      !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(contentType)) {
    // Detect from URL extension
    if (fileUrl.includes('.png')) {
      contentType = 'image/png';
    } else if (fileUrl.includes('.webp')) {
      contentType = 'image/webp';
    } else if (fileUrl.includes('.gif')) {
      contentType = 'image/gif';
    } else {
      contentType = 'image/jpeg'; // Default to JPEG
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  console.log('✅ Image downloaded, size:', base64.length, 'chars, type:', contentType);
  return { base64, mimeType: contentType };
}

// AI to parse natural language expense input
async function parseExpenseWithAI(text: string, preferredCurrency: string | null): Promise<{
  amount: number;
  currency: string;
  category: ExpenseCategory;
  merchant: string;
  description: string | null;
} | null> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extrae información de gasto de texto en lenguaje natural. Responde SOLO JSON:
{"amount": number, "currency": "PEN|COP|CLP|USD|MXN|ARS|EUR", "category": "alimentacion|transporte|salud|entretenimiento|servicios|compras|educacion|hogar|otros", "merchant": "string", "description": "string|null"}

REGLAS:
- amount: el número del monto (sin símbolos). Si no hay monto claro, responde null
- currency: detecta de palabras como "soles", "pesos", "dólares", o códigos. Default: ${preferredCurrency || 'PEN'}
- category: categoriza según el contexto
- merchant: nombre del comercio/servicio (capitalizado)
- description: texto adicional relevante o null

CATEGORÍAS:
- alimentacion: comida, restaurantes, supermercados, mercado, delivery
- transporte: uber, taxi, bus, gasolina, pasajes
- salud: farmacia, medicina, doctor, hospital
- entretenimiento: cine, netflix, spotify, gym, bar
- servicios: luz, agua, internet, software, APIs, peluquería
- compras: ropa, electrónica, amazon, regalos
- educacion: cursos, libros, universidad
- hogar: alquiler, muebles, mascotas
- otros: si no encaja

Ejemplos:
"mercado wong 97 soles!" → {"amount": 97, "currency": "PEN", "category": "alimentacion", "merchant": "Wong", "description": null}
"gasté 50 en uber" → {"amount": 50, "currency": "${preferredCurrency || 'PEN'}", "category": "transporte", "merchant": "Uber", "description": null}
"netflix 15 dólares" → {"amount": 15, "currency": "USD", "category": "entretenimiento", "merchant": "Netflix", "description": null}
"almuerzo con María 35 soles" → {"amount": 35, "currency": "PEN", "category": "alimentacion", "merchant": "Almuerzo", "description": "con María"}
"pagué la luz 120" → {"amount": 120, "currency": "${preferredCurrency || 'PEN'}", "category": "servicios", "merchant": "Luz", "description": null}
"hola como estas" → null`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      max_tokens: 150,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content?.trim() || 'null';
    console.log('🤖 Parse expense AI response:', content);

    if (content === 'null' || content.includes('"amount": null')) {
      return null;
    }

    const result = JSON.parse(content);

    if (!result || !result.amount || result.amount <= 0) {
      return null;
    }

    return {
      amount: result.amount,
      currency: result.currency || preferredCurrency || 'PEN',
      category: CATEGORIES.includes(result.category) ? result.category : 'otros',
      merchant: result.merchant?.substring(0, 50) || 'Gasto',
      description: result.description || null,
    };
  } catch (err) {
    console.error('Parse expense AI error:', err);
    return null;
  }
}

// AI Categorization for quick expenses (legacy, kept for structured input)
async function categorizeWithAI(description: string): Promise<{ category: ExpenseCategory; merchant: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Categoriza este gasto. Responde SOLO JSON:
{"category": "alimentacion|transporte|salud|entretenimiento|servicios|compras|educacion|hogar|otros", "merchant": "nombre del comercio"}

CATEGORÍAS:
- alimentacion: comida, bebidas, restaurantes, supermercados, mercado, delivery de comida, frutas, verduras, carne, pan
- transporte: uber, taxi, bus, gasolina, pasajes, peajes, vuelos, estacionamiento
- salud: farmacia, medicina, doctor, hospital, dentista, seguro médico, lentes, psicólogo
- entretenimiento: cine, netflix, spotify, juegos, gym, bar, fiestas, deportes, conciertos, museos
- servicios: luz, agua, internet, teléfono, software, APIs, suscripciones digitales, hosting, IA (openai, claude), peluquería, barbería, lavandería, cerrajero, plomero
- compras: ropa, zapatos, electrónica, amazon, tiendas online, regalos, maquillaje, perfumes
- educacion: cursos, libros, universidad, platzi, udemy, idiomas, clases particulares
- hogar: alquiler, muebles, limpieza, reparaciones, mascotas, decoración, electrodomésticos
- otros: SOLO si realmente no encaja en ninguna otra

MERCHANT: Nombre del comercio/servicio. Si es genérico (ej: "verduras"), capitaliza la descripción.

Ejemplos:
"verduras del mercado" → {"category": "alimentacion", "merchant": "Mercado"}
"uber al trabajo" → {"category": "transporte", "merchant": "Uber"}
"openai api" → {"category": "servicios", "merchant": "OpenAI"}
"netflix" → {"category": "entretenimiento", "merchant": "Netflix"}
"corte de pelo" → {"category": "servicios", "merchant": "Peluquería"}
"comida para el perro" → {"category": "hogar", "merchant": "Comida Mascota"}
"regalo cumpleaños" → {"category": "compras", "merchant": "Regalo"}`,
        },
        {
          role: 'user',
          content: description,
        },
      ],
      max_tokens: 100,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content.trim());

    return {
      category: CATEGORIES.includes(result.category) ? result.category : 'otros',
      merchant: result.merchant?.substring(0, 50) || description.split(/\s+/).slice(0, 2).join(' '),
    };
  } catch (err) {
    console.error('AI categorization error:', err);
    // Fallback: use description as merchant
    const words = description.split(/\s+/);
    return {
      category: 'otros',
      merchant: words.slice(0, 2).join(' ').substring(0, 50),
    };
  }
}

// OpenAI Vision
async function analyzeImage(base64: string, mimeType: string, preferredCurrency: string | null) {
  console.log('🤖 Calling OpenAI, preferred currency:', preferredCurrency);

  const currencyHint = preferredCurrency
    ? `\n\nIMPORTANTE: Este usuario normalmente registra gastos en ${preferredCurrency}. Si no hay evidencia clara de otra moneda, usa ${preferredCurrency}.`
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Extrae info de comprobantes de pago. Responde SOLO JSON:
{"amount": number, "currency": "COP|CLP|USD|PEN|MXN|ARS|EUR", "category": "${CATEGORIES.join('|')}", "merchant": "string", "description": "string|null", "date": "YYYY-MM-DD", "confidence": 0.0-1.0}

REGLAS CRÍTICAS para detectar moneda:
1. Si menciona Bogotá, Colombia, NIT, Cámara de Comercio, Credibanco → SIEMPRE es COP (pesos colombianos)
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

  let content = response.choices[0]?.message?.content || '{}';
  console.log('📝 OpenAI response:', content);

  content = content.trim();
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) content = jsonMatch[1].trim();

  return JSON.parse(content);
}

// Database functions
async function getOrCreateUser(telegramId: string, firstName: string, username?: string) {
  const { data } = await supabase.from('users').select().eq('telegram_id', telegramId).single();
  if (data) return data;

  await supabase.from('users').insert({
    telegram_id: telegramId,
    phone: `telegram:${telegramId}`,
    name: firstName,
    username: username,
  });
  return { telegram_id: telegramId, phone: `telegram:${telegramId}` };
}

async function checkDuplicate(expense: { user_phone: string; merchant: string; amount: number; date: string }) {
  const { data } = await supabase
    .from('expenses')
    .select('id, merchant, amount, date')
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
}

async function updateExpenseCurrency(id: string, userPhone: string, currency: string) {
  const { error } = await supabase
    .from('expenses')
    .update({ currency })
    .eq('id', id)
    .eq('user_phone', userPhone);
  if (error) throw error;
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
  const { data } = await supabase
    .from('expenses')
    .select('currency')
    .eq('user_phone', userPhone)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const e of data) {
    counts[e.currency] = (counts[e.currency] || 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topCurrency, topCount] = sorted[0];

  return topCount / data.length >= 0.6 ? topCurrency : null;
}

async function getMonthlyExpenses(userPhone: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data } = await supabase
    .from('expenses')
    .select()
    .eq('user_phone', userPhone)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });

  return data || [];
}

// Message handlers
async function handlePhoto(chatId: number, userPhone: string, photo: TelegramPhotoSize[]) {
  console.log('🖼️ Processing photo for', userPhone);

  try {
    await sendChatAction(chatId, 'typing');
    await sendMessage(chatId, '⏳ Analizando tu comprobante...');

    // Get largest photo
    const largestPhoto = photo[photo.length - 1];
    const fileUrl = await getFile(largestPhoto.file_id);
    const { base64, mimeType } = await downloadImageAsBase64(fileUrl);

    const preferredCurrency = await getUserPreferredCurrency(userPhone);
    const data = await analyzeImage(base64, mimeType, preferredCurrency);

    if (data.error) throw new Error(data.error);

    const expenseData = {
      user_phone: userPhone,
      amount: data.amount,
      currency: data.currency || 'COP',
      category: CATEGORIES.includes(data.category) ? data.category : 'otros',
      merchant: data.merchant,
      description: data.description,
      date: data.date,
    };

    // Check for duplicates
    const duplicate = await checkDuplicate({
      user_phone: userPhone,
      merchant: data.merchant,
      amount: data.amount,
      date: data.date,
    });

    if (duplicate) {
      setPendingDuplicate(String(chatId), duplicate.id, expenseData);
      await sendMessage(
        chatId,
        `⚠️ *Gasto duplicado detectado*\n\nYa tienes un gasto de $${data.amount.toLocaleString()} en ${data.merchant} el ${data.date}.\n\nEscribe "si" para reemplazar el anterior.`
      );
      return;
    }

    const expense = await saveExpense(expenseData);
    const emoji = CATEGORIES_EMOJI[expense.category] || '📦';

    await sendMessage(
      chatId,
      `✅ ${emoji} Gasto registrado\n\n💰 $${expense.amount.toLocaleString()} ${expense.currency}\n🏪 ${expense.merchant}\n📁 ${expense.category}\n📅 ${expense.date}`
    );
  } catch (err) {
    console.error('❌ handlePhoto error:', err);
    await sendMessage(chatId, `❌ Error: ${err instanceof Error ? err.message : 'No pude procesar la imagen'}`);
  }
}

async function handleDocument(chatId: number, userPhone: string, document: TelegramDocument) {
  console.log('📄 Processing document for', userPhone, 'mime:', document.mime_type);

  try {
    await sendChatAction(chatId, 'typing');
    await sendMessage(chatId, '⏳ Analizando tu comprobante...');

    const fileUrl = await getFile(document.file_id);
    const { base64, mimeType } = await downloadImageAsBase64(fileUrl);

    const preferredCurrency = await getUserPreferredCurrency(userPhone);
    const data = await analyzeImage(base64, mimeType, preferredCurrency);

    if (data.error) throw new Error(data.error);

    const expenseData = {
      user_phone: userPhone,
      amount: data.amount,
      currency: data.currency || 'COP',
      category: CATEGORIES.includes(data.category) ? data.category : 'otros',
      merchant: data.merchant,
      description: data.description,
      date: data.date,
    };

    // Check for duplicates
    const duplicate = await checkDuplicate({
      user_phone: userPhone,
      merchant: data.merchant,
      amount: data.amount,
      date: data.date,
    });

    if (duplicate) {
      setPendingDuplicate(String(chatId), duplicate.id, expenseData);
      await sendMessage(
        chatId,
        `⚠️ *Gasto duplicado detectado*\n\nYa tienes un gasto de $${data.amount.toLocaleString()} en ${data.merchant} el ${data.date}.\n\nEscribe "si" para reemplazar el anterior.`
      );
      return;
    }

    const expense = await saveExpense(expenseData);
    const emoji = CATEGORIES_EMOJI[expense.category] || '📦';

    await sendMessage(
      chatId,
      `✅ ${emoji} Gasto registrado\n\n💰 $${expense.amount.toLocaleString()} ${expense.currency}\n🏪 ${expense.merchant}\n📁 ${expense.category}\n📅 ${expense.date}`
    );
  } catch (err) {
    console.error('❌ handleDocument error:', err);
    await sendMessage(chatId, `❌ Error: ${err instanceof Error ? err.message : 'No pude procesar el documento'}`);
  }
}

async function transcribeAudio(fileUrl: string): Promise<string> {
  console.log('🎤 Downloading audio from:', fileUrl);

  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error('Failed to download audio');

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log('🎤 Transcribing audio, size:', buffer.length, 'bytes');

  // Create a File-like object for OpenAI
  const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'es',
  });

  console.log('📝 Transcription:', transcription.text);
  return transcription.text;
}

async function handleVoice(chatId: number, userPhone: string, voice: TelegramVoice, userInfo?: { firstName: string; username?: string }) {
  console.log('🎤 Processing voice for', userPhone, 'duration:', voice.duration, 's');

  try {
    await sendChatAction(chatId, 'typing');
    await sendMessage(chatId, '🎤 Escuchando tu mensaje...');

    // Download and transcribe audio
    const fileUrl = await getFile(voice.file_id);
    const transcription = await transcribeAudio(fileUrl);

    if (!transcription || transcription.trim().length === 0) {
      await sendMessage(chatId, '❌ No pude entender el audio. Intenta de nuevo hablando más claro.');
      return;
    }

    // Show what we understood
    await sendMessage(chatId, `📝 Entendí: "${transcription}"\n\n⏳ Procesando...`);

    // Process the transcription as text (this will handle quick expense parsing)
    await handleText(chatId, userPhone, transcription, userInfo);
  } catch (err) {
    console.error('❌ handleVoice error:', err);
    await sendMessage(chatId, `❌ Error: ${err instanceof Error ? err.message : 'No pude procesar el audio'}`);
  }
}

async function handleText(chatId: number, userPhone: string, text: string, userInfo?: { firstName: string; username?: string }) {
  const lowerText = text.toLowerCase().trim();

  // Check for pending duplicate confirmation
  if (['si', 'sí', 'yes', 'ok'].includes(lowerText)) {
    const pending = getPendingDuplicate(String(chatId));
    if (pending) {
      await deleteExpense(pending.duplicateId, userPhone);
      const expense = await saveExpense(pending.newData);
      clearPendingDuplicate(String(chatId));

      const emoji = CATEGORIES_EMOJI[expense.category as string] || '📦';
      await sendMessage(
        chatId,
        `✅ ${emoji} Gasto actualizado\n\n💰 $${Number(expense.amount).toLocaleString()} ${expense.currency}\n🏪 ${expense.merchant}\n📁 ${expense.category}\n📅 ${expense.date}`
      );
      return;
    }
  }

  // Commands
  if (['/start', '/ayuda', '/help', 'ayuda', 'help', 'hola'].includes(lowerText)) {
    await sendMessage(chatId, HELP_MESSAGE, 'MarkdownV2');
    return;
  }

  // Link command - generate code for dashboard
  if (['/vincular', '/link', 'vincular'].includes(lowerText)) {
    try {
      const telegramId = userPhone.replace('telegram:', '');
      const code = await createLinkCode(
        telegramId,
        userInfo?.firstName || 'Usuario',
        userInfo?.username
      );
      await sendMessage(
        chatId,
        `🔗 Código de vinculación\n\n` +
        `Tu código es: ${code}\n\n` +
        `1. Abre el dashboard:\n${DASHBOARD_URL}\n\n` +
        `2. Ingresa este código\n` +
        `3. ¡Listo! Podrás ver tus gastos\n\n` +
        `⏰ El código expira en 10 minutos.`
      );
    } catch (err) {
      await sendMessage(chatId, '❌ Error al generar código. Intenta de nuevo.');
    }
    return;
  }

  if (['/mes', '/resumen', 'mes', 'resumen'].includes(lowerText)) {
    const expenses = await getMonthlyExpenses(userPhone);
    if (!expenses.length) {
      await sendMessage(chatId, '📭 No tienes gastos este mes.');
      return;
    }

    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    let msg = `📅 Gastos del mes\n\n`;
    for (const e of expenses.slice(0, 8)) {
      msg += `${CATEGORIES_EMOJI[e.category] || '📦'} $${Number(e.amount).toLocaleString()} - ${e.merchant}\n`;
    }
    msg += `\n💰 Total: $${total.toLocaleString()}`;
    await sendMessage(chatId, msg);
    return;
  }

  if (['/categorias', 'categorias'].includes(lowerText)) {
    const expenses = await getMonthlyExpenses(userPhone);
    if (!expenses.length) {
      await sendMessage(chatId, '📭 No tienes gastos este mes.');
      return;
    }

    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    }

    let msg = `📊 Gastos por categoría\n\n`;
    for (const [cat, total] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      msg += `${CATEGORIES_EMOJI[cat] || '📦'} ${cat}: $${total.toLocaleString()}\n`;
    }
    await sendMessage(chatId, msg);
    return;
  }

  if (['/borrar', 'borrar', 'eliminar'].includes(lowerText)) {
    const lastExpense = await getLastExpense(userPhone);
    if (!lastExpense) {
      await sendMessage(chatId, '📭 No tienes gastos para borrar.');
      return;
    }

    await deleteExpense(lastExpense.id, userPhone);
    await sendMessage(
      chatId,
      `🗑️ Gasto eliminado\n\nSe borró: $${Number(lastExpense.amount).toLocaleString()} en ${lastExpense.merchant} (${lastExpense.date})`
    );
    return;
  }

  // Bank notifications setup: /banco
  if (['/banco', 'banco', '/bank'].includes(lowerText)) {
    const telegramId = userPhone.replace('telegram:', '');
    const emailAddress = `gastos+${telegramId}@martinbeasnunez.co`;

    await sendMessage(
      chatId,
      `🏦 Conectar notificaciones del banco\n\n` +
      `Para registrar automáticamente tus gastos desde tu banco, configura las notificaciones por email:\n\n` +
      `1. Entra a la app de tu banco (Interbank, BCP, etc.)\n` +
      `2. Activa notificaciones por email\n` +
      `3. Usa este email:\n\n` +
      `📧 ${emailAddress}\n\n` +
      `¡Listo! Cada vez que hagas un consumo con tu tarjeta, se registrará automáticamente aquí.`
    );
    return;
  }

  // Change currency: /moneda COP or moneda COP
  const currencyMatch = lowerText.match(/^(?:\/moneda|moneda|cambiar|currency)\s+(cop|clp|usd|pen|mxn|ars|eur)$/i);
  if (currencyMatch) {
    const newCurrency = currencyMatch[1].toUpperCase();
    const lastExpense = await getLastExpense(userPhone);

    if (!lastExpense) {
      await sendMessage(chatId, '📭 No tienes gastos para modificar.');
      return;
    }

    await updateExpenseCurrency(lastExpense.id, userPhone, newCurrency);
    await sendMessage(
      chatId,
      `💱 Moneda actualizada\n\n${lastExpense.merchant}: $${Number(lastExpense.amount).toLocaleString()} ${lastExpense.currency} → ${newCurrency}`
    );
    return;
  }

  // Try to parse any text as an expense using AI
  const preferredCurrency = await getUserPreferredCurrency(userPhone);
  const parsedExpense = await parseExpenseWithAI(text, preferredCurrency);

  if (parsedExpense) {
    const expenseData = {
      user_phone: userPhone,
      amount: parsedExpense.amount,
      currency: parsedExpense.currency,
      category: parsedExpense.category,
      merchant: parsedExpense.merchant,
      description: parsedExpense.description,
      date: new Date().toISOString().split('T')[0],
    };

    try {
      const expense = await saveExpense(expenseData);
      const emoji = CATEGORIES_EMOJI[expense.category] || '📦';

      await sendMessage(
        chatId,
        `✅ ${emoji} Gasto registrado\n\n💰 $${expense.amount.toLocaleString()} ${expense.currency}\n🏪 ${expense.merchant}\n📁 ${expense.category}\n📅 ${expense.date}`
      );
    } catch (err) {
      console.error('Error saving expense:', err);
      await sendMessage(chatId, '❌ Error al guardar el gasto. Intenta de nuevo.');
    }
    return;
  }

  await sendMessage(chatId, '🤔 No entendí. Escribe /ayuda o envía una foto de tu comprobante.\n\n💡 Tip: Puedes escribir "mercado wong 97 soles" o "50 uber".');
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🔔 Telegram webhook:', req.method, new Date().toISOString());

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      provider: 'telegram',
      time: new Date().toISOString(),
      env: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
      }
    });
  }

  if (req.method === 'POST') {
    const update = req.body as TelegramUpdate;
    console.log('📥 Telegram update:', JSON.stringify(update, null, 2));

    if (!update.message) {
      return res.status(200).json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id;
    const userPhone = `telegram:${message.from.id}`;

    // Deduplication
    if (isProcessed(update.update_id)) {
      console.log('⏭️ Skipping duplicate update:', update.update_id);
      return res.status(200).json({ ok: true });
    }

    try {
      await getOrCreateUser(String(message.from.id), message.from.first_name, message.from.username);

      if (message.photo && message.photo.length > 0) {
        await handlePhoto(chatId, userPhone, message.photo);
      } else if (message.document && message.document.mime_type?.startsWith('image/')) {
        // Handle images sent as documents (e.g., screenshots)
        await handleDocument(chatId, userPhone, message.document);
      } else if (message.voice) {
        // Handle voice messages
        await handleVoice(chatId, userPhone, message.voice, {
          firstName: message.from.first_name,
          username: message.from.username,
        });
      } else if (message.text) {
        await handleText(chatId, userPhone, message.text, {
          firstName: message.from.first_name,
          username: message.from.username,
        });
      }
    } catch (err) {
      console.error('❌ Telegram handler error:', err);
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
