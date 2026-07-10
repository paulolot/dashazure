const fs = require('fs');

const missingCode = fs.readFileSync('missing_code_only.js', 'utf8');
let appJs = fs.readFileSync('app.js', 'utf8');

// The missing code is a collection of fragments separated by // ---- NEXT ----
const chunks = missingCode.split('// ---- NEXT ----');

let appended = 0;
let newCode = '\n\n/**********************************************************\n * RECOVERED FUNCTIONS (appended automatically)\n **********************************************************/\n\n';

for (const chunk of chunks) {
    if (chunk.includes('function ')) {
        // Simple heuristic: if it looks like a complete function or a large chunk of logic, append it.
        // We will just append all chunks that contain 'function ' to the end of the file for now,
        // and then we can fix any syntax errors.
        // However, some chunks are just replacements inside existing functions.
        // If a chunk starts with "function ", it's likely a full function replacement.
        const lines = chunk.trim().split('\n');
        let isFullFunction = false;
        for (const line of lines) {
            if (line.startsWith('function ') || line.startsWith('async function ')) {
                isFullFunction = true;
                break;
            }
        }
        
        if (isFullFunction) {
            newCode += chunk.trim() + '\n\n';
            appended++;
        }
    }
}

fs.appendFileSync('app.js', newCode);
console.log(`Appended ${appended} function chunks to app.js.`);
