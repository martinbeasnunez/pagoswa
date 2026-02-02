export const CATEGORIES = [
  'alimentacion',
  'transporte',
  'salud',
  'entretenimiento',
  'servicios',
  'compras',
  'educacion',
  'hogar',
  'otros',
] as const;

export const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  alimentacion: { emoji: '🍔', color: 'hsl(25, 95%, 53%)', label: 'Alimentación' },
  transporte: { emoji: '🚗', color: 'hsl(217, 91%, 60%)', label: 'Transporte' },
  salud: { emoji: '💊', color: 'hsl(142, 71%, 45%)', label: 'Salud' },
  entretenimiento: { emoji: '🎬', color: 'hsl(280, 87%, 53%)', label: 'Entretenimiento' },
  servicios: { emoji: '📱', color: 'hsl(199, 89%, 48%)', label: 'Servicios' },
  compras: { emoji: '🛍️', color: 'hsl(340, 82%, 52%)', label: 'Compras' },
  educacion: { emoji: '📚', color: 'hsl(47, 96%, 53%)', label: 'Educación' },
  hogar: { emoji: '🏠', color: 'hsl(173, 80%, 40%)', label: 'Hogar' },
  otros: { emoji: '📦', color: 'hsl(215, 14%, 45%)', label: 'Otros' },
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  CLP: '$',
  COP: '$',
  USD: '$',
  PEN: 'S/',
  MXN: '$',
  ARS: '$',
  EUR: '€',
};
