import * as XLSX from 'xlsx';

/**
 * Export a retro object to an Excel (.xlsx) file.
 * Each column becomes a sheet header, entries are rows, votes are shown.
 */
export function exportRetroToExcel(retro) {
  const worksheetData = [];

  // Header row: column names
  const headers = retro.columns.map(col => col.name);
  const voteHeaders = retro.columns.map(col => `${col.name} (Oy)`);

  // Find max entries across all columns
  const maxEntries = Math.max(...retro.columns.map(col => col.entries.length), 0);

  // Build rows: interleave entry text and vote count per column
  const allHeaders = [];
  retro.columns.forEach(col => {
    allHeaders.push(col.name);
    allHeaders.push('Oy');
  });
  worksheetData.push(allHeaders);

  for (let i = 0; i < maxEntries; i++) {
    const row = [];
    retro.columns.forEach(col => {
      const entry = col.entries[i];
      row.push(entry ? entry.text : '');
      row.push(entry ? entry.votes : '');
    });
    worksheetData.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Style: auto-size columns
  ws['!cols'] = allHeaders.map((h, i) => ({
    wch: i % 2 === 0 ? 40 : 8
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Retro');

  XLSX.writeFile(wb, `${retro.title.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ ]/g, '_')}_retro.xlsx`);
}
