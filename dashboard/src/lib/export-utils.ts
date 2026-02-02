import { type Expense } from './supabase';
import { CATEGORY_CONFIG } from './constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function exportToCSV(expenses: Expense[], filename: string = 'gastos') {
  const headers = ['Fecha', 'Comercio', 'Categoría', 'Descripción', 'Monto', 'Moneda'];

  const rows = expenses.map((expense) => [
    expense.date,
    expense.merchant,
    CATEGORY_CONFIG[expense.category]?.label || expense.category,
    expense.description || '',
    expense.amount.toString(),
    expense.currency || 'CLP',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToJSON(expenses: Expense[], filename: string = 'gastos') {
  const data = expenses.map((expense) => ({
    fecha: expense.date,
    comercio: expense.merchant,
    categoria: CATEGORY_CONFIG[expense.category]?.label || expense.category,
    descripcion: expense.description,
    monto: expense.amount,
    moneda: expense.currency,
  }));

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generatePDFContent(expenses: Expense[], title: string = 'Reporte de Gastos') {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const byCategory = expenses.reduce((acc, e) => {
    const cat = CATEGORY_CONFIG[e.category]?.label || e.category;
    acc[cat] = (acc[cat] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  // Generate HTML for printing
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        h1 { color: #10b981; margin-bottom: 8px; }
        .date { color: #666; font-size: 14px; margin-bottom: 32px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 32px; }
        .summary h2 { margin: 0 0 16px 0; font-size: 18px; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .summary-item { }
        .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .summary-value { font-size: 24px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
        th { background: #f9f9f9; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #666; }
        td { font-size: 14px; }
        .amount { text-align: right; font-weight: 600; }
        .category { display: inline-block; padding: 4px 8px; background: #e5e5e5; border-radius: 4px; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>📊 ${title}</h1>
      <p class="date">Generado el ${format(new Date(), "d 'de' MMMM, yyyy", { locale: es })}</p>

      <div class="summary">
        <h2>Resumen</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total de gastos</div>
            <div class="summary-value">$${total.toLocaleString()}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Transacciones</div>
            <div class="summary-value">${expenses.length}</div>
          </div>
        </div>
      </div>

      <h2>Por Categoría</h2>
      <table>
        <thead>
          <tr>
            <th>Categoría</th>
            <th class="amount">Total</th>
            <th class="amount">%</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([cat, amount]) => `
            <tr>
              <td>${cat}</td>
              <td class="amount">$${amount.toLocaleString()}</td>
              <td class="amount">${((amount / total) * 100).toFixed(1)}%</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <h2 style="margin-top: 32px;">Detalle de Transacciones</h2>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Comercio</th>
            <th>Categoría</th>
            <th class="amount">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${expenses
            .map(
              (e) => `
            <tr>
              <td>${format(new Date(e.date), 'd MMM yyyy', { locale: es })}</td>
              <td>${e.merchant}</td>
              <td><span class="category">${CATEGORY_CONFIG[e.category]?.label || e.category}</span></td>
              <td class="amount">$${e.amount.toLocaleString()} ${e.currency || ''}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  return html;
}

export function printReport(expenses: Expense[], title?: string) {
  const html = generatePDFContent(expenses, title);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
