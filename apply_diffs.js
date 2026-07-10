const fs = require('fs');

const mods = JSON.parse(fs.readFileSync('modifications.json', 'utf8'));
let content = fs.readFileSync('temp_dash/app.js', 'utf8').replace(/\r\n/g, '\n');

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
        const target = chunk.TargetContent.replace(/\r\n/g, '\n');
        const repl = chunk.ReplacementContent.replace(/\r\n/g, '\n');
        
        if (content.includes(target)) {
            if (chunk.AllowMultiple) {
                content = content.split(target).join(repl);
            } else {
                content = content.replace(target, repl);
            }
            successCount++;
        } else {
            failCount++;
        }
    }
}

fs.writeFileSync('app.js', content, 'utf8');
console.log(`Saved app.js (Length: ${content.length})`);
