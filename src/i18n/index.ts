import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import en from "./locales/en.json";
import pl from "./locales/pl.json";
import de from "./locales/de.json";

import { readStoredLanguage, storeLanguage } from "./storage";

const resources = {
  de: { translation: de },
  pl: { translation: pl },
  en: { translation: en },
} as const;

export type SupportedLanguage = keyof typeof resources;

function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return lang === "de" || lang === "pl" || lang === "en";
}

function getDeviceLanguage(): SupportedLanguage {
  const locales = Localization.getLocales?.() ?? [];
  const languageCode = locales[0]?.languageCode;
  if (languageCode && isSupportedLanguage(languageCode)) return languageCode;
  return "de";
}

async function resolveInitialLanguage(): Promise<SupportedLanguage> {
  const stored = await readStoredLanguage();
  if (stored) return stored;
  return getDeviceLanguage();
}

export async function initI18n() {
  if (i18n.isInitialized) return;

  const initialLanguage = await resolveInitialLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: "de",
    defaultNS: "translation",
    ns: ["translation"],
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export async function setLanguage(lang: SupportedLanguage) {
  await i18n.changeLanguage(lang);
  await storeLanguage(lang);
}

export default i18n;