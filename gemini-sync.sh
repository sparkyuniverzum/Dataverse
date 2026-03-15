#!/bin/bash

# 1. NAČTENÍ .ENV (Force load)
if [ -f .env ]; then
  echo "🔑 Načítám konfiguraci z .env..."
  # Načte řádky, které nejsou komentáře, a exportuje je
  export $(grep -v '^#' .env | xargs)
fi

# Kontrola klíče
if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ CHYBA: GEMINI_API_KEY nebyl nalezen v .env ani v systému!"
  exit 1
fi

echo "🔍 Skenuji projekt..."

# 2. SBĚR DAT
KONTENT=""
if [ -f "package.json" ]; then
  KONTENT+="\n--- SOUBOR: package.json ---\n$(cat package.json)\n"
fi

# Najdeme soubory přes Git
for file in $(git ls-files | grep -E '\.(js|jsx|ts|tsx|md)$'); do
  if [ "$file" == "package.json" ]; then continue; fi
  echo "📄 Přidávám: $file"
  KONTENT+="\n--- SOUBOR: $file ---\n$(cat "$file")\n"
done

# 3. PŘÍPRAVA PAYLOADU (S modelem 001)
echo "⚙️  Generuji JSON..."
JSON_SAFE_KONTENT=$(echo "$KONTENT" | jq -Rs .)

JSON_PAYLOAD=$(cat <<EOF
{
 "model": "models/gemini-3.1-pro-preview",
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": $JSON_SAFE_KONTENT }]
    }
  ],
  "ttl": "43200s"
}
EOF
)

# 4. ODESLÁNÍ
echo "🚀 Odesílám do Gemini Cache..."
echo "$JSON_PAYLOAD" > .tmp_payload.json

# Uložíme i hlavičku odpovědi, abychom viděli chyby v JSON formátu
RESPONSE=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/cachedContents?key=$GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
--data-binary @.tmp_payload.json)

rm .tmp_payload.json

# 5. VYHODNOCENÍ
CACHE_ID=$(echo "$RESPONSE" | jq -r '.name // empty')

if [ -n "$CACHE_ID" ] && [ "$CACHE_ID" != "null" ]; then
  echo "$CACHE_ID" > .gemini_cache
  echo "✅ SYNC ÚSPĚŠNÝ!"
  echo "🔑 Cache ID: $CACHE_ID"
else
  echo "❌ CHYBA PŘI VYTVÁŘENÍ CACHE:"
  echo "$RESPONSE" | jq .
fi
