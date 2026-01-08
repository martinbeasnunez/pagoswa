// Tipos para la base de datos (Supabase)
export interface Expense {
  id: string;
  user_phone: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  merchant: string;
  description: string | null;
  date: string;
  image_url: string | null;
  raw_text: string | null;
  created_at: string;
}

export type ExpenseCategory =
  | 'alimentacion'
  | 'transporte'
  | 'salud'
  | 'entretenimiento'
  | 'servicios'
  | 'compras'
  | 'educacion'
  | 'hogar'
  | 'otros';

export interface User {
  phone: string;
  name: string | null;
  created_at: string;
  monthly_budget: number | null;
}

// Tipos para WhatsApp
export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document';
  text?: { body: string };
  image?: { id: string; mime_type: string };
  document?: { id: string; mime_type: string; filename: string };
}

export interface WhatsAppWebhookBody {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: WhatsAppMessage[];
      };
      field: string;
    }>;
  }>;
}

// Tipos para análisis de IA
export interface ExtractedExpenseData {
  amount: number;
  currency: string;
  category: ExpenseCategory;
  merchant: string;
  description: string | null;
  date: string;
  confidence: number;
}

// Comandos del bot
export type BotCommand =
  | 'resumen'
  | 'mes'
  | 'categorias'
  | 'ayuda'
  | 'exportar';
