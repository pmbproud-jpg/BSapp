import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupportedLanguage } from "./index";

const KEY = "app.language";

export async function readStoredLanguage(): Promise<SupportedLanguage | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "de" || v === "pl" || v === "en") return v;
    return null;
  } catch {
    return null;
  }
}

export async function storeLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, lang);
  } catch {
    // ignore
  }
}