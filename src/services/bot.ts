import type { WhatsAppMessage, BotCommand } from '../types/index.js';
import * as whatsapp from './whatsapp.js';
import * as openai from './openai.js';
import * as db from './supabase.js';

const HELP_MESSAGE = `🤖 *PagosWA - Tu asistente de gastos*

📸 *Envía una foto* de tu factura, boleta o comprobante y lo registraré automáticamente.

📝 *Comandos disponibles:*
• *resumen* - Ver resumen de gastos recientes
• *mes* - Ver gastos del mes actual
• *categorias* - Ver gastos por categoría
• *ayuda* - Mostrar este mensaje

💡 *Tip:* Puedes escribir los comandos con o sin mayúsculas.`;

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

function parseCommand(text: string): BotCommand | null {
  const normalized = text.toLowerCase().trim();
  const commands: BotCommand[] = ['resumen', 'mes', 'categorias', 'ayuda', 'exportar'];

  for (const cmd of commands) {
    if (normalized === cmd || normalized === `/${cmd}`) {
      return cmd;
    }
  }

  // Alias
  if (normalized === 'help' || normalized === '/help') return 'ayuda';
  if (normalized === 'hola' || normalized === 'hi') return 'ayuda';

  return null;
}

export async function handleMessage(message: WhatsAppMessage): Promise<void> {
  const userPhone = message.from;

  try {
    // Asegurar que el usuario existe
    await db.getOrCreateUser(userPhone);

    if (message.type === 'image') {
      await handleImageMessage(message);
    } else if (message.type === 'text' && message.text) {
      await handleTextMessage(message);
    } else {
      await whatsapp.sendMessage(
        userPhone,
        '❓ Por ahora solo puedo procesar imágenes y texto. Envía una foto de tu comprobante o escribe "ayuda".'
      );
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await whatsapp.sendMessage(
      userPhone,
      '❌ Ocurrió un error procesando tu mensaje. Por favor intenta de nuevo.'
    );
  }
}

async function handleImageMessage(message: WhatsAppMessage): Promise<void> {
  const userPhone = message.from;

  if (!message.image) return;

  // Reaccionar para indicar que estamos procesando
  await whatsapp.sendReaction(userPhone, message.id, '⏳');

  try {
    // Descargar y convertir imagen
    const { base64, mimeType } = await whatsapp.getMediaAsBase64(message.image.id);

    // Analizar con OpenAI Vision
    const expenseData = await openai.analyzeExpenseImage(base64, mimeType);

    // Guardar en base de datos
    const expense = await db.saveExpense({
      user_phone: userPhone,
      amount: expenseData.amount,
      currency: expenseData.currency,
      category: expenseData.category,
      merchant: expenseData.merchant,
      description: expenseData.description,
      date: expenseData.date,
      image_url: null, // Podríamos guardar en Supabase Storage
      raw_text: null,
    });

    // Reaccionar con éxito
    await whatsapp.sendReaction(userPhone, message.id, '✅');

    // Enviar confirmación
    const emoji = CATEGORIES_EMOJI[expense.category] || '📦';
    const confirmMessage = `${emoji} *Gasto registrado*

💰 *Monto:* $${expense.amount.toLocaleString()} ${expense.currency}
🏪 *Comercio:* ${expense.merchant}
📁 *Categoría:* ${expense.category}
📅 *Fecha:* ${expense.date}
${expense.description ? `📝 *Descripción:* ${expense.description}` : ''}

_Confianza del análisis: ${Math.round(expenseData.confidence * 100)}%_`;

    await whatsapp.sendMessage(userPhone, confirmMessage);
  } catch (error) {
    await whatsapp.sendReaction(userPhone, message.id, '❌');

    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    await whatsapp.sendMessage(
      userPhone,
      `❌ No pude procesar la imagen: ${errorMessage}\n\nAsegúrate de que sea una foto clara de un comprobante de pago.`
    );
  }
}

async function handleTextMessage(message: WhatsAppMessage): Promise<void> {
  const userPhone = message.from;
  const text = message.text?.body || '';

  const command = parseCommand(text);

  if (!command) {
    await whatsapp.sendMessage(
      userPhone,
      '🤔 No entendí ese comando. Escribe *ayuda* para ver las opciones disponibles, o envía una foto de tu comprobante.'
    );
    return;
  }

  switch (command) {
    case 'ayuda':
      await whatsapp.sendMessage(userPhone, HELP_MESSAGE);
      break;

    case 'resumen':
      await handleResumenCommand(userPhone);
      break;

    case 'mes':
      await handleMesCommand(userPhone);
      break;

    case 'categorias':
      await handleCategoriasCommand(userPhone);
      break;

    case 'exportar':
      await whatsapp.sendMessage(userPhone, '📊 La función de exportar estará disponible pronto.');
      break;
  }
}

async function handleResumenCommand(userPhone: string): Promise<void> {
  const expenses = await db.getExpensesByUser(userPhone, 10);

  if (expenses.length === 0) {
    await whatsapp.sendMessage(
      userPhone,
      '📭 No tienes gastos registrados aún. ¡Envía una foto de tu primer comprobante!'
    );
    return;
  }

  const report = await openai.generateExpenseReport(
    expenses.map((e) => ({
      category: e.category,
      amount: e.amount,
      merchant: e.merchant,
      date: e.date,
    }))
  );

  await whatsapp.sendMessage(userPhone, `📊 *Resumen de tus últimos gastos*\n\n${report}`);
}

async function handleMesCommand(userPhone: string): Promise<void> {
  const now = new Date();
  const expenses = await db.getMonthlyExpenses(userPhone, now.getFullYear(), now.getMonth() + 1);

  if (expenses.length === 0) {
    await whatsapp.sendMessage(
      userPhone,
      '📭 No tienes gastos registrados este mes. ¡Envía una foto de tu comprobante!'
    );
    return;
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  let message = `📅 *Gastos de ${monthNames[now.getMonth()]} ${now.getFullYear()}*\n\n`;

  for (const expense of expenses.slice(0, 10)) {
    const emoji = CATEGORIES_EMOJI[expense.category] || '📦';
    message += `${emoji} $${expense.amount.toLocaleString()} - ${expense.merchant}\n`;
  }

  if (expenses.length > 10) {
    message += `\n_...y ${expenses.length - 10} gastos más_\n`;
  }

  message += `\n💰 *Total del mes:* $${total.toLocaleString()}`;

  await whatsapp.sendMessage(userPhone, message);
}

async function handleCategoriasCommand(userPhone: string): Promise<void> {
  const now = new Date();
  const byCategory = await db.getExpensesByCategory(userPhone, now.getFullYear(), now.getMonth() + 1);

  if (Object.keys(byCategory).length === 0) {
    await whatsapp.sendMessage(
      userPhone,
      '📭 No tienes gastos registrados este mes.'
    );
    return;
  }

  let message = `📊 *Gastos por categoría (este mes)*\n\n`;
  let grandTotal = 0;

  // Ordenar por monto
  const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);

  for (const [category, data] of sorted) {
    const emoji = CATEGORIES_EMOJI[category] || '📦';
    message += `${emoji} *${category}*: $${data.total.toLocaleString()} (${data.count} ${data.count === 1 ? 'gasto' : 'gastos'})\n`;
    grandTotal += data.total;
  }

  message += `\n💰 *Total:* $${grandTotal.toLocaleString()}`;

  await whatsapp.sendMessage(userPhone, message);
}
