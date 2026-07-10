const fs = require('fs');
const content = fs.readFileSync('c:/Imex/drive-download-20260522T152140Z-3-001/fiscal-bugs.csv', 'utf8');
const lines = content.split('\n');
console.log('Line 1: >' + lines[1] + '<');
