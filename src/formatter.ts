export function formatDate(date: Date, format: 'ISO' | 'US' | 'EU'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (format) {
    case 'US':
      return `${month}/${day}/${year}`;
    case 'EU':
      return `${day}/${month}/${year}`;
    case 'ISO':
    default:
      return `${year}-${month}-${day}`;
  }
}

export function escapeCSV(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
