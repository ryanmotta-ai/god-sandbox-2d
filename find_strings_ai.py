import re
with open('src/ai/EntityAI.ts', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.finditer(r'([`\'"][^\n`\'"]{5,}[`\'"])', text)
for m in matches:
    s = m.group(1)
    if ' ' in s and not 'import ' in s and not 'export ' in s:
        print(f"L{text.count(chr(10), 0, m.start())+1}: {s}")
