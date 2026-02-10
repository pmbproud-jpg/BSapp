import os
import re
import json

# Ścieżka do projektu
PROJECT_PATH = "/home/claude/BSapp/BSapp"

# Zbierz wszystkie klucze z plików TSX/TS
all_keys = set()

# Pattern dla t("klucz") i t('klucz')
pattern_static = re.compile(r't\(["\']([^"\']+)["\']\)')
# Pattern dla t(`...${...}...`)
pattern_dynamic = re.compile(r't\(`([^`]+)`\)')

def extract_keys_from_file(filepath):
    keys = set()
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Statyczne klucze
            for match in pattern_static.findall(content):
                if not match.startswith('*') and '(' not in match:
                    keys.add(match)
            
            # Dynamiczne klucze - rozwiń je
            for match in pattern_dynamic.findall(content):
                # Znajdź bazowy klucz i zmienną
                if '${' in match:
                    base = match.split('${')[0]
                    # Rozwiń możliwe wartości
                    if 'projects.status' in match:
                        for status in ['planning', 'active', 'on_hold', 'completed', 'cancelled']:
                            keys.add(f"projects.status.{status}")
                    elif 'tasks.status' in match:
                        for status in ['pending', 'in_progress', 'completed', 'cancelled']:
                            keys.add(f"tasks.status.{status}")
                    elif 'tasks.priority' in match:
                        for priority in ['low', 'medium', 'high', 'urgent']:
                            keys.add(f"tasks.priority.{priority}")
                    elif 'common.roles' in match:
                        for role in ['admin', 'zarzad', 'management', 'project_manager', 'bauleiter', 'worker']:
                            keys.add(f"common.roles.{role}")
                    elif 'roles.' in match:
                        for role in ['admin', 'zarzad', 'management', 'project_manager', 'bauleiter', 'worker']:
                            keys.add(f"roles.{role}")
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return keys

# Przeszukaj wszystkie pliki
for root, dirs, files in os.walk(PROJECT_PATH):
    # Pomiń node_modules
    if 'node_modules' in root:
        continue
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            keys = extract_keys_from_file(filepath)
            all_keys.update(keys)

# Posortuj i wyświetl
sorted_keys = sorted(all_keys)
print("=== WSZYSTKIE KLUCZE TŁUMACZEŃ ===")
print(f"Łącznie: {len(sorted_keys)} kluczy\n")

# Grupuj po prefiksie
groups = {}
for key in sorted_keys:
    prefix = key.split('.')[0]
    if prefix not in groups:
        groups[prefix] = []
    groups[prefix].append(key)

for prefix in sorted(groups.keys()):
    print(f"\n--- {prefix.upper()} ({len(groups[prefix])}) ---")
    for key in groups[prefix]:
        print(f"  {key}")

