const fs = require('fs');
const path = require('path');

const brainPath = path.join(process.env.USERPROFILE, '.gemini', 'antigravity', 'brain');
const dirs = fs.readdirSync(brainPath);

let modifications = [];

for (const dir of dirs) {
    const transcriptPath = path.join(brainPath, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
    if (!fs.existsSync(transcriptPath)) continue;

    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    for (const line of lines) {
        if (!line) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.tool_calls) {
                for (const call of entry.tool_calls) {
                    if (call.name === 'multi_replace_file_content' || call.name === 'replace_file_content' || call.name === 'write_to_file') {
                        const targetFile = call.args.TargetFile;
                        if (targetFile && targetFile.includes('app.js')) {
                            const tsStr = entry.created_at || entry.timestamp || '';
                            modifications.push({
                                ts: tsStr,
                                dir: dir,
                                callName: call.name,
                                args: call.args
                            });
                        }
                    }
                }
            }
        } catch(e) {}
    }
}

modifications.sort((a, b) => a.ts.localeCompare(b.ts));

console.log(`Found ${modifications.length} modifications for app.js`);
for (let i = 0; i < modifications.length; i++) {
    console.log(`${i+1}. [${modifications[i].ts}] ${modifications[i].callName} in ${modifications[i].dir}`);
}

fs.writeFileSync('modifications.json', JSON.stringify(modifications, null, 2));
