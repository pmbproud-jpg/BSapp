import json
import os

PROJECT_PATH = "/home/claude/BSapp/BSapp"
LOCALES_PATH = f"{PROJECT_PATH}/src/i18n/locales"

def flatten_json(data, prefix=''):
    """Spłaszcza zagnieżdżony JSON do listy kluczy"""
    items = []
    for k, v in data.items():
        new_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(flatten_json(v, new_key))
        else:
            items.append(new_key)
    return items

# Załaduj wszystkie pliki tłumaczeń
translations = {}
for lang in ['pl', 'de', 'en']:
    filepath = f"{LOCALES_PATH}/{lang}.json"
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            translations[lang] = set(flatten_json(data))
            print(f"✅ {lang}.json - poprawny JSON, {len(translations[lang])} kluczy")
    except json.JSONDecodeError as e:
        print(f"❌ {lang}.json - BŁĄD JSON: {e}")
    except Exception as e:
        print(f"❌ {lang}.json - BŁĄD: {e}")

# Sprawdź różnice między językami
print("\n=== PORÓWNANIE JĘZYKÓW ===")
all_keys = translations['pl'] | translations['de'] | translations['en']

missing = {}
for lang in ['pl', 'de', 'en']:
    missing[lang] = all_keys - translations[lang]
    if missing[lang]:
        print(f"\n❌ Brakuje w {lang}.json ({len(missing[lang])}):")
        for key in sorted(missing[lang]):
            print(f"   - {key}")
    else:
        print(f"✅ {lang}.json - kompletny")

# Sprawdź wymagane klucze z audytu
required_keys = [
    "tasks.status.pending",
    "tasks.status.in_progress", 
    "tasks.status.completed",
    "tasks.status.cancelled",
    "tasks.priority.low",
    "tasks.priority.medium",
    "tasks.priority.high",
    "tasks.priority.urgent",
    "projects.status.planning",
    "projects.status.active",
    "projects.status.on_hold",
    "projects.status.completed",
    "projects.status.cancelled",
    "settings.company_member",
    "roles.admin",
    "roles.worker",
    "common.roles.admin",
    "common.roles.worker"
]

print("\n=== WERYFIKACJA KLUCZOWYCH TŁUMACZEŃ ===")
for lang in ['pl', 'de', 'en']:
    print(f"\n{lang.upper()}:")
    for key in required_keys:
        if key in translations[lang]:
            print(f"  ✅ {key}")
        else:
            print(f"  ❌ {key} - BRAK!")

