import json
import glob
import os

logs = glob.glob(r'C:\Users\palot\.gemini\antigravity\brain\*\.system_generated\logs\transcript_full.jsonl')
for log in logs:
    with open(log, 'r', encoding='utf-8') as f:
        content = f.read()
        if 'app.js' in content and 'multi_replace_file_content' in content:
            print(f"Found in {log}")
