const fs = require('fs');

const mods = JSON.parse(fs.readFileSync('modifications.json', 'utf8'));
let content = fs.readFileSync('temp_dash/app.js', 'utf8').replace(/\r\n/g, '\n');

// A function to find the start and end indices of target in content ignoring whitespace
function fuzzyFind(content, target) {
    const cTokens = content.split(/(\s+)/);
    const tTokens = target.trim().split(/(\s+)/).filter(t => t.trim().length > 0);
    
    if (tTokens.length === 0) return -1;
    
    let cIndex = 0;
    while (cIndex < cTokens.length) {
        let match = true;
        let tIndex = 0;
        let cMatchIndex = cIndex;
        let startCharIndex = -1;
        let endCharIndex = -1;
        
        // Find start char index
        let currChar = 0;
        for(let i=0; i<cIndex; i++) currChar += cTokens[i].length;
        startCharIndex = currChar;
        
        while (tIndex < tTokens.length && cMatchIndex < cTokens.length) {
            if (cTokens[cMatchIndex].trim() === '') {
                cMatchIndex++;
                continue;
            }
            if (cTokens[cMatchIndex] !== tTokens[tIndex]) {
                match = false;
                break;
            }
            tIndex++;
            cMatchIndex++;
        }
        
        if (match && tIndex === tTokens.length) {
            // Found a match!
            let currCharEnd = 0;
            for(let i=0; i<cMatchIndex; i++) currCharEnd += cTokens[i].length;
            endCharIndex = currCharEnd;
            return { start: startCharIndex, end: endCharIndex };
        }
        cIndex++;
    }
    return null;
}

let successCount = 0;
let failCount = 0;

for (const mod of mods) {
    if (mod.callName === 'write_to_file') continue;
    if (new Date(mod.ts) > new Date('2026-07-03T19:34:00Z')) continue;

    const args = mod.args;
    let chunks = [];
    if (mod.callName === 'multi_replace_file_content') {
        chunks = args.ReplacementChunks || [];
    } else if (mod.callName === 'replace_file_content') {
        chunks = [{
            TargetContent: args.TargetContent,
            ReplacementContent: args.ReplacementContent,
            AllowMultiple: args.AllowMultiple
        }];
    }

    for (const chunk of chunks) {
        if (!chunk.TargetContent) continue;
        const target = chunk.TargetContent;
        const repl = chunk.ReplacementContent.replace(/\r\n/g, '\n');
        
        const exactMatch = content.includes(target.replace(/\r\n/g, '\n'));
        if (exactMatch) {
            content = content.replace(target.replace(/\r\n/g, '\n'), repl);
            successCount++;
        } else {
            const fuzzyMatch = fuzzyFind(content, target);
            if (fuzzyMatch) {
                content = content.substring(0, fuzzyMatch.start) + repl + content.substring(fuzzyMatch.end);
                successCount++;
            } else {
                failCount++;
                console.log(`Failed chunk in ${mod.ts}`);
            }
        }
    }
}

console.log(`Successfully applied ${successCount} chunks. Failed ${failCount}.`);
fs.writeFileSync('app_recovered_fuzzy.js', content, 'utf8');
console.log(`Saved app_recovered_fuzzy.js (Length: ${content.length})`);
