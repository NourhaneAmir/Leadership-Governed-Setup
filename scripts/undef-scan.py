# -*- coding: utf-8 -*-
"""Find free identifiers in the extracted modules.

The BIEmbed crash was a symbol moved to domain.jsx whose dependency stayed in
LeadershipApp.jsx: an ES module resolves it to nothing and throws at render.
Nothing catches this -- Rollup does not error, and there is no lint on this
machine. So: collect every identifier that looks like a call or a JSX tag, and
subtract everything the file declares or imports.

Heuristic, deliberately: it over-reports (words from inside strings) rather
than under-reports. Check each hit by eye.
"""
import io, re, os

ROOT = r'C:\Users\nourh\OneDrive - Andalusia Group\Desktop\Work\Leadership Governed Setup\src'

FILES = [
    r'modules\leadership\domain.jsx',
    r'modules\leadership\store.jsx',
    r'modules\leadership\screens\BusinessIntelligence.jsx',
    r'modules\leadership\screens\OrgReports.jsx',
    r'modules\leadership\screens\Hierarchy.jsx',
    r'shared\ui.jsx',
    r'shared\format.js',
]

BUILTIN = set("""
React useState useEffect useMemo useRef useCallback useContext createContext
Math JSON Object Array String Number Boolean Date RegExp Map Set Promise Error
console window document localStorage sessionStorage navigator location fetch
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame alert
confirm prompt Intl isNaN parseInt parseFloat encodeURIComponent decodeURIComponent
URL Blob File FileReader Event CustomEvent AbortController structuredClone
if for while switch return function const let var new typeof instanceof
catch try throw else do class extends super this void delete in of await async
""".split())


def scan(path):
    src = io.open(path, encoding='utf-8').read()
    code = re.sub(r'/\*.*?\*/', ' ', src, flags=re.S)
    code = re.sub(r'(?m)^\s*//.*$', ' ', code)
    # Only double-quoted strings are stripped, and only within one line. A
    # single-quote stripper pairs an apostrophe in JSX prose ("isn't") with the
    # next one and swallows the code between them -- which hid a real
    # declaration on the first run of this script.
    code = re.sub(r'"(?:\\.|[^"\\\n])*"', '""', code)

    declared = set()
    declared |= set(re.findall(r'\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', code))
    for grp in re.findall(r'\b(?:const|let|var)\s*[\{\[]([^\}\]]*)[\}\]]', code):
        for piece in grp.split(','):
            piece = piece.strip()
            if ':' in piece:
                piece = piece.split(':')[-1].strip()
            m = re.match(r'([A-Za-z_$][\w$]*)', piece)
            if m:
                declared.add(m.group(1))
    for grp in re.findall(r'import\s+\{([^}]*)\}\s+from', code):
        for piece in grp.split(','):
            piece = piece.strip().split(' as ')[-1].strip()
            if piece:
                declared.add(piece)
    for name in re.findall(r'import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)', code):
        declared.add(name)
    for grp in re.findall(r'function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)', code):
        declared |= set(re.findall(r'[A-Za-z_$][\w$]*', grp))
    for grp in re.findall(r'\(([^()]*)\)\s*=>', code):
        declared |= set(re.findall(r'[A-Za-z_$][\w$]*', grp))
    for name in re.findall(r'(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>', code):
        declared.add(name)
    for name in re.findall(r'catch\s*\(\s*([A-Za-z_$][\w$]*)', code):
        declared.add(name)

    used = set(re.findall(r'<([A-Z][\w$]*)', code))
    for m in re.finditer(r'(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(', code):
        used.add(m.group(1))

    return sorted(n for n in used - declared - BUILTIN if not n[0].isdigit())


bad = 0
for rel in FILES:
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        print('MISSING %s' % rel); bad += 1; continue
    free = scan(path)
    if free:
        print('\n%s' % rel)
        for n in free:
            print('   free: %s' % n)
        bad += len(free)
print('\n%d suspect identifier(s)' % bad)
