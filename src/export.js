import writeExcelFile from 'write-excel-file/browser';

/**
 * Export a retro object to an Excel (.xlsx) file.
 * Each column becomes a sheet header, entries are rows, votes are shown.
 */
export async function exportRetroToExcel(retro) {
  const worksheetData = [];

  // Header row: column names
  const headers = retro.columns.map(col => col.name);
  const voteHeaders = retro.columns.map(col => `${col.name} (Votes)`);

  // Find max entries across all columns
  const maxEntries = Math.max(...retro.columns.map(col => col.entries.length), 0);

  // Build rows: interleave entry text and vote count per column
  const allHeaders = [];
  retro.columns.forEach(col => {
    allHeaders.push(col.name);
    allHeaders.push('Votes');
  });
  worksheetData.push(allHeaders);

  for (let i = 0; i < maxEntries; i++) {
    const row = [];
    retro.columns.forEach(col => {
      const entry = col.entries[i];
      row.push(entry ? entry.text : null);
      row.push(entry ? entry.votes : null);
    });
    worksheetData.push(row);
  }

  // Auto-size: wide text columns, narrow vote-count columns
  const columns = allHeaders.map((_, i) => ({ width: i % 2 === 0 ? 40 : 8 }));

  const fileName = `${retro.title.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ ]/g, '_')}_retro.xlsx`;
  await writeExcelFile(worksheetData, { sheet: 'Retro', columns }).toFile(fileName);
}
