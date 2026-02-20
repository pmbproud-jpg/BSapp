/**
 * Hook do automatycznego tłumaczenia tekstu PL <-> DE.
 * Używa MyMemory API (darmowe, bez klucza API, limit 5000 znaków/dzień).
 * Fallback: zwraca oryginalny tekst jeśli tłumaczenie się nie uda.
 */

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

export type TranslatePair = "pl|de" | "de|pl" | "pl|en" | "en|pl" | "de|en" | "en|de";

export async function translateText(text: string, langpair: TranslatePair): Promise<string> {
  if (!text.trim()) return "";
  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${langpair}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data?.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    return text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

/**
 * Detect if text is likely Polish or German.
 * Simple heuristic based on common character patterns.
 */
export function detectLanguage(text: string): "pl" | "de" | "unknown" {
  const lower = text.toLowerCase();
  // Polish-specific characters and common words
  const plPatterns = /[ąćęłńóśźż]|(\b(jest|nie|tak|ale|czy|się|dla|jak|ten|to|na|do|od|po|za|przy|przez|bez|nad|pod|przed|między)\b)/;
  // German-specific characters and common words
  const dePatterns = /[äöüß]|(\b(ist|nicht|und|oder|aber|der|die|das|ein|eine|für|mit|von|auf|aus|bei|nach|über|unter|zwischen)\b)/;

  const plScore = (lower.match(plPatterns) || []).length;
  const deScore = (lower.match(dePatterns) || []).length;

  if (plScore > deScore) return "pl";
  if (deScore > plScore) return "de";
  return "unknown";
}

/**
 * Auto-translate: detects source language and translates to the other.
 * PL -> DE or DE -> PL
 */
export async function autoTranslatePLDE(text: string): Promise<{ translated: string; from: string; to: string }> {
  const detected = detectLanguage(text);
  if (detected === "pl") {
    const translated = await translateText(text, "pl|de");
    return { translated, from: "PL", to: "DE" };
  } else if (detected === "de") {
    const translated = await translateText(text, "de|pl");
    return { translated, from: "DE", to: "PL" };
  } else {
    // Default: try PL -> DE
    const translated = await translateText(text, "pl|de");
    return { translated, from: "PL", to: "DE" };
  }
}
