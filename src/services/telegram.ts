import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import * as openai from './openai.js';
import * as db from './supabase.js';

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

const HELP_MESSAGE = `🤖 *PagosWA \\- Tu asistente de gastos*

📸 *Envía una foto* de tu factura, boleta o comprobante y lo registraré automáticamente\\.

📝 *Comandos disponibles:*
• /resumen \\- Ver resumen de gastos recientes
• /mes \\- Ver gastos del mes actual
• /categorias \\- Ver gastos por categoría
• /ayuda \\- Mostrar este mensaje

💡 *Tip:* Solo envía la foto y yo me encargo del resto\\.`;

export function createBot(token: string): Telegraf {
  const bot = new Telegraf(token);

  // Comando /start y /ayuda
  bot.command(['start', 'ayuda', 'help'], async (ctx) => {
    await ctx.replyWithMarkdownV2(HELP_MESSAGE);
  });

  // Comando /resumen
  bot.command('resumen', async (ctx) => {
    const userId = ctx.from.id.toString();

    try {
      const expenses = await db.getExpensesByUser(userId, 10);

      if (expenses.length === 0) {
        await ctx.reply('📭 No tienes gastos registrados aún. ¡Envía una foto de tu primer comprobante!');
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

      await ctx.reply(`📊 *Resumen de tus últimos gastos*\n\n${report}`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error en /resumen:', error);
      await ctx.reply('❌ Error al obtener el resumen. Intenta de nuevo.');
    }
  });

  // Comando /mes
  bot.command('mes', async (ctx) => {
    const userId = ctx.from.id.toString();
    const now = new Date();

    try {
      const expenses = await db.getMonthlyExpenses(userId, now.getFullYear(), now.getMonth() + 1);

      if (expenses.length === 0) {
        await ctx.reply('📭 No tienes gastos registrados este mes. ¡Envía una foto de tu comprobante!');
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

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error en /mes:', error);
      await ctx.reply('❌ Error al obtener los gastos del mes. Intenta de nuevo.');
    }
  });

  // Comando /categorias
  bot.command('categorias', async (ctx) => {
    const userId = ctx.from.id.toString();
    const now = new Date();

    try {
      const byCategory = await db.getExpensesByCategory(userId, now.getFullYear(), now.getMonth() + 1);

      if (Object.keys(byCategory).length === 0) {
        await ctx.reply('📭 No tienes gastos registrados este mes.');
        return;
      }

      let message = `📊 *Gastos por categoría (este mes)*\n\n`;
      let grandTotal = 0;

      const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);

      for (const [category, data] of sorted) {
        const emoji = CATEGORIES_EMOJI[category] || '📦';
        message += `${emoji} *${category}*: $${data.total.toLocaleString()} (${data.count} ${data.count === 1 ? 'gasto' : 'gastos'})\n`;
        grandTotal += data.total;
      }

      message += `\n💰 *Total:* $${grandTotal.toLocaleString()}`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error en /categorias:', error);
      await ctx.reply('❌ Error al obtener las categorías. Intenta de nuevo.');
    }
  });

  // Procesar fotos
  bot.on(message('photo'), async (ctx) => {
    const userId = ctx.from.id.toString();
    const userName = ctx.from.first_name || null;

    try {
      // Reaccionar para indicar que estamos procesando
      await ctx.reply('⏳ Analizando tu comprobante...');

      // Asegurar que el usuario existe
      await db.getOrCreateUser(userId, userName ?? undefined);

      // Obtener la foto de mayor resolución
      const photos = ctx.message.photo;
      const photo = photos[photos.length - 1];

      if (!photo) {
        await ctx.reply('❌ No pude obtener la foto. Intenta de nuevo.');
        return;
      }

      // Descargar la foto
      const file = await ctx.telegram.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString('base64');

      // Analizar con OpenAI Vision
      const expenseData = await openai.analyzeExpenseImage(base64, 'image/jpeg');

      // Guardar en base de datos
      const expense = await db.saveExpense({
        user_phone: userId, // Usamos el ID de Telegram como identificador
        amount: expenseData.amount,
        currency: expenseData.currency,
        category: expenseData.category,
        merchant: expenseData.merchant,
        description: expenseData.description,
        date: expenseData.date,
        image_url: null,
        raw_text: null,
      });

      // Enviar confirmación
      const emoji = CATEGORIES_EMOJI[expense.category] || '📦';
      const confirmMessage = `${emoji} *Gasto registrado*

💰 *Monto:* $${expense.amount.toLocaleString()} ${expense.currency}
🏪 *Comercio:* ${expense.merchant}
📁 *Categoría:* ${expense.category}
📅 *Fecha:* ${expense.date}
${expense.description ? `📝 *Descripción:* ${expense.description}` : ''}

_Confianza del análisis: ${Math.round(expenseData.confidence * 100)}%_`;

      await ctx.reply(confirmMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error procesando foto:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      await ctx.reply(`❌ No pude procesar la imagen: ${errorMessage}\n\nAsegúrate de que sea una foto clara de un comprobante de pago.`);
    }
  });

  // Mensaje de texto no reconocido
  bot.on(message('text'), async (ctx) => {
    await ctx.reply('🤔 Para registrar un gasto, envíame una *foto* de tu comprobante.\n\nEscribe /ayuda para ver los comandos disponibles.', { parse_mode: 'Markdown' });
  });

  return bot;
}
