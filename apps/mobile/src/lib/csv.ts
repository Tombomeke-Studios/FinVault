// CSV building for transaction exports (#24) — mirrors
// apps/web-dashboard/src/lib/csv.ts (the apps implement features in parallel).

export interface ExportRow {
  date: string;        // ISO timestamp
  description: string;
  category: string;
  status: string;
  amount: number;      // signed: positive = money in
  currency: string;
}

const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function buildTransactionsCsv(rows: ExportRow[]): string {
  const header = ['Date', 'Description', 'Category', 'Status', 'Amount', 'Currency'];
  const lines = rows.map(r =>
    [r.date, r.description, r.category, r.status, r.amount.toFixed(2), r.currency].map(esc).join(',')
  );
  return [header.join(','), ...lines].join('\r\n');
}

export function exportFileName(date = new Date()): string {
  return `finvault-transactions-${date.toISOString().slice(0, 10)}.csv`;
}
