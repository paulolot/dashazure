const fs = require('fs');
const content = fs.readFileSync('c:/Imex/drive-download-20260522T152140Z-3-001/fiscal-workitems.csv', 'utf8');
const lines = content.split('\n');
const headers = lines[0].trim().split(',');
const bugs = [];
for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].trim().split(',');
    const obj = {};
    headers.forEach((h, idx) => obj[h] = values[idx]);
    if (obj.Tipo === 'Bug') bugs.push(obj);
}
// date filter simulator (roughly): 
const today = new Date('2026-07-09T10:47:48-03:00');
const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
const filteredBugs = bugs.filter(wi => {
    // If not closed, include
    if (wi.State !== 'Closed' && wi.State !== 'Removed' && wi.BoardColumn !== 'Concluído' && wi.BoardColumn !== 'Ideias' && wi.BoardColumn !== 'Removed') return true;
    // If closed, check date
    if (wi.DataFechamento) {
        const fd = new Date(wi.DataFechamento);
        return fd >= past30;
    }
    return false;
});
console.log('Filtered bugs count:', filteredBugs.length);
