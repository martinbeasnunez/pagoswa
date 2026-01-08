-- PagosWA Database Schema
-- Ejecutar en Supabase SQL Editor

-- Enum para categorías de gastos
CREATE TYPE expense_category AS ENUM (
  'alimentacion',
  'transporte',
  'salud',
  'entretenimiento',
  'servicios',
  'compras',
  'educacion',
  'hogar',
  'otros'
);

-- Tabla de usuarios
CREATE TABLE users (
  phone VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100),
  monthly_budget DECIMAL(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de gastos
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CLP',
  category expense_category NOT NULL DEFAULT 'otros',
  merchant VARCHAR(200) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  image_url TEXT,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX idx_expenses_user_phone ON expenses(user_phone);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_user_date ON expenses(user_phone, date DESC);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso (para uso con service_role key desde el backend)
-- El backend usa la service_role key que bypasea RLS
-- Si quieres acceso desde el cliente, necesitarás políticas específicas

-- Vista útil: resumen mensual por usuario
CREATE OR REPLACE VIEW monthly_summary AS
SELECT
  user_phone,
  DATE_TRUNC('month', date) AS month,
  category,
  COUNT(*) AS transaction_count,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount
FROM expenses
GROUP BY user_phone, DATE_TRUNC('month', date), category
ORDER BY month DESC, total_amount DESC;

-- Función para obtener total del mes actual
CREATE OR REPLACE FUNCTION get_current_month_total(p_user_phone VARCHAR)
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM expenses
  WHERE user_phone = p_user_phone
    AND date >= DATE_TRUNC('month', CURRENT_DATE)
    AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
$$ LANGUAGE SQL;
