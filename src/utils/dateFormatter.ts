// src/utils/dateFormatter.ts
// Utility functions for date formatting with localization

type SupportedLanguage = 'pl' | 'de' | 'en';

const TRANSLATIONS = {
  pl: {
    months: [
      "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
      "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
    ],
    monthsShort: ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"],
    days: ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"],
    daysShort: ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"],
  },
  de: {
    months: [
      "Januar", "Februar", "März", "April", "Mai", "Juni",
      "Juli", "August", "September", "Oktober", "November", "Dezember"
    ],
    monthsShort: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
    days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    daysShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
  },
  en: {
    months: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
};

/**
 * Formatuje datę według języka
 * @param date - Data jako string (ISO) lub obiekt Date
 * @param language - Język (pl, de, en)
 * @param format - Format: 'full' | 'short' | 'numeric'
 */
export function formatDate(
  date: string | Date | null | undefined,
  language: string,
  format: 'full' | 'short' | 'numeric' = 'full'
): string {
  if (!date) return '—';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  
  const lang = (language as SupportedLanguage) || 'de';
  const trans = TRANSLATIONS[lang] || TRANSLATIONS.de;
  
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  
  switch (format) {
    case 'numeric':
      if (lang === 'en') {
        return `${(month + 1).toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
      }
      return `${day.toString().padStart(2, '0')}.${(month + 1).toString().padStart(2, '0')}.${year}`;
    
    case 'short':
      if (lang === 'en') {
        return `${trans.monthsShort[month]} ${day}, ${year}`;
      }
      return `${day}. ${trans.monthsShort[month]} ${year}`;
    
    case 'full':
    default:
      if (lang === 'en') {
        return `${trans.months[month]} ${day}, ${year}`;
      }
      return `${day}. ${trans.months[month]} ${year}`;
  }
}

/**
 * Formatuje datę z dniem tygodnia
 * @param date - Data jako string (ISO) lub obiekt Date
 * @param language - Język (pl, de, en)
 */
export function formatDateWithDay(
  date: string | Date | null | undefined,
  language: string
): string {
  if (!date) return '—';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  
  const lang = (language as SupportedLanguage) || 'de';
  const trans = TRANSLATIONS[lang] || TRANSLATIONS.de;
  
  const dayOfWeek = trans.days[d.getDay()];
  const formattedDate = formatDate(d, lang, 'full');
  
  return `${dayOfWeek}, ${formattedDate}`;
}

/**
 * Formatuje zakres dat
 * @param startDate - Data początkowa
 * @param endDate - Data końcowa
 * @param language - Język (pl, de, en)
 */
export function formatDateRange(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined,
  language: string
): string {
  const start = formatDate(startDate, language, 'short');
  const end = formatDate(endDate, language, 'short');
  
  if (start === '—' && end === '—') return '—';
  if (start === '—') return end;
  if (end === '—') return start;
  
  return `${start} – ${end}`;
}

/**
 * Formatuje względną datę (np. "za 3 dni", "2 dni temu")
 * @param date - Data jako string (ISO) lub obiekt Date
 * @param language - Język (pl, de, en)
 */
export function formatRelativeDate(
  date: string | Date | null | undefined,
  language: string
): string {
  if (!date) return '—';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  
  const now = new Date();
  const diffTime = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const lang = (language as SupportedLanguage) || 'de';
  
  const translations = {
    pl: {
      today: 'Dzisiaj',
      tomorrow: 'Jutro',
      yesterday: 'Wczoraj',
      inDays: (n: number) => `za ${n} dni`,
      daysAgo: (n: number) => `${n} dni temu`,
    },
    de: {
      today: 'Heute',
      tomorrow: 'Morgen',
      yesterday: 'Gestern',
      inDays: (n: number) => `in ${n} Tagen`,
      daysAgo: (n: number) => `vor ${n} Tagen`,
    },
    en: {
      today: 'Today',
      tomorrow: 'Tomorrow',
      yesterday: 'Yesterday',
      inDays: (n: number) => `in ${n} days`,
      daysAgo: (n: number) => `${n} days ago`,
    },
  };
  
  const t = translations[lang] || translations.de;
  
  if (diffDays === 0) return t.today;
  if (diffDays === 1) return t.tomorrow;
  if (diffDays === -1) return t.yesterday;
  if (diffDays > 1 && diffDays <= 7) return t.inDays(diffDays);
  if (diffDays < -1 && diffDays >= -7) return t.daysAgo(Math.abs(diffDays));
  
  return formatDate(d, lang, 'short');
}

/**
 * Hook do użycia w komponentach React
 */
export function useDateFormatter(language: string) {
  return {
    format: (date: string | Date | null | undefined, fmt?: 'full' | 'short' | 'numeric') => 
      formatDate(date, language, fmt),
    formatWithDay: (date: string | Date | null | undefined) => 
      formatDateWithDay(date, language),
    formatRange: (start: string | Date | null | undefined, end: string | Date | null | undefined) => 
      formatDateRange(start, end, language),
    formatRelative: (date: string | Date | null | undefined) => 
      formatRelativeDate(date, language),
  };
}
