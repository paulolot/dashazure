import json
import os
import re

os.makedirs('conversas', exist_ok=True)
transcript_path = r'C:\Users\palot\.gemini\antigravity\brain\f603ac4a-e900-4c59-8b7a-03450b97de10\.system_generated\logs\transcript.jsonl'
output_path = r'conversas\instrucoes.md'

instructions = []
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'USER_INPUT':
                content = data.get('content', '')
                match = re.search(r'<USER_REQUEST>\n(.*?)\n</USER_REQUEST>', content, re.DOTALL)
                if match:
                    instructions.append(match.group(1).strip())
                else:
                    instructions.append(content.strip())
        except Exception:
            pass

with open(output_path, 'w', encoding='utf-8') as out:
    out.write("# Instruções do Usuário\n\n")
    for i, inst in enumerate(instructions, 1):
        out.write(f"## Instrução {i}\n\n{inst}\n\n")
