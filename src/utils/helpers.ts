/**
 * Współdzielone funkcje pomocnicze używane w wielu komponentach.
 */

import { Platform, Linking } from "react-native";

/**
 * Otwiera link — na web tworzy element <a> i klika (omija blokery popup),
 * na natywnych platformach używa Linking.openURL.
 */
export const openLink = (url: string) => {
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    Linking.openURL(url);
  }
};

/**
 * Liczy dni robocze (pon-pt) między datami włącznie.
 */
export const countWorkdays = (from: string, to: string): number => {
  let count = 0;
  const d = new Date(from);
  const end = new Date(to);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
};

/**
 * Pure JS base64 decode — fallback dla Hermes gdzie atob może nie istnieć.
 */
export const base64Decode = (input: string): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let str = input.replace(/=+$/, "");
  let output = "";
  for (let i = 0; i < str.length; i += 4) {
    const a = chars.indexOf(str.charAt(i));
    const b = chars.indexOf(str.charAt(i + 1));
    const c = chars.indexOf(str.charAt(i + 2));
    const d = chars.indexOf(str.charAt(i + 3));
    output += String.fromCharCode((a << 2) | (b >> 4));
    if (c !== -1 && c !== 64) output += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (d !== -1 && d !== 64) output += String.fromCharCode(((c & 3) << 6) | d);
  }
  return output;
};
