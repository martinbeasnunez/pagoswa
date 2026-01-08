import OpenAI from 'openai';
import type { ExtractedExpenseData, ExpenseCategory } from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CATEGORIES: ExpenseCategory[] = [
  'alimentacion',
  'transporte',
  'salud',
  'entretenimiento',
  'servicios',
  'compras',
  'educacion',
  'hogar',
  'otros',
];

const SYSTEM_PROMPT = `Eres un asistente experto en extraer información de facturas, boletas y comprobantes de pago.

Tu tarea es analizar imágenes de documentos de pago y extraer la siguiente información:
- amount: Monto total (número, sin símbolos de moneda)
- currency: Moneda (CLP, USD, EUR, etc.)
- category: Categoría del gasto. DEBE ser una de: ${CATEGORIES.join(', ')}
- merchant: Nombre del comercio o proveedor
- description: Descripción breve del gasto (opcional)
- date: Fecha del documento en formato YYYY-MM-DD
- confidence: Qué tan seguro estás de la extracción (0.0 a 1.0)

Responde ÚNICAMENTE con un JSON válido, sin markdown ni texto adicional.

Ejemplo de respuesta:
{"amount": 15990, "currency": "CLP", "category": "alimentacion", "merchant": "Supermercado Líder", "description": "Compra semanal", "date": "2024-01-15", "confidence": 0.95}

Si no puedes extraer algún campo, usa valores por defecto razonables.
Si la imagen no es un documento de pago válido, responde: {"error": "No es un documento de pago válido"}`;

export async function analyzeExpenseImage(imageBase64: string, mimeType: string): Promise<ExtractedExpenseData> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: 'Extrae la información de este documento de pago.',
          },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No se recibió respuesta de OpenAI');
  }

  try {
    const parsed = JSON.parse(content);

    if (parsed.error) {
      throw new Error(parsed.error);
    }

    // Validar y normalizar categoría
    if (!CATEGORIES.includes(parsed.category)) {
      parsed.category = 'otros';
    }

    return parsed as ExtractedExpenseData;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Error al parsear respuesta de IA: ' + content);
    }
    throw error;
  }
}

export async function generateExpenseReport(expenses: Array<{ category: string; amount: number; merchant: string; date: string }>): Promise<string> {
  if (expenses.length === 0) {
    return 'No tienes gastos registrados en este período.';
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory: Record<string, number> = {};

  for (const expense of expenses) {
    byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amount;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente financiero amigable. Genera resúmenes cortos y útiles de gastos. Usa emojis apropiados. Responde en español.',
      },
      {
        role: 'user',
        content: `Genera un resumen breve de estos gastos:
Total: $${total.toLocaleString()}
Por categoría: ${JSON.stringify(byCategory)}
Número de transacciones: ${expenses.length}

El resumen debe ser corto (máximo 500 caracteres) y mencionar las categorías principales de gasto.`,
      },
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || 'Error generando resumen.';
}
