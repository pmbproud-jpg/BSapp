import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

interface LocalizedDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  label?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  required?: boolean;
  clearable?: boolean;
}

// Tłumaczenia miesięcy i dni
const TRANSLATIONS = {
  pl: {
    months: [
      "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
      "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
    ],
    monthsShort: ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"],
    days: ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"],
    daysShort: ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"],
    daysMin: ["N", "P", "W", "Ś", "C", "P", "S"],
    today: "Dzisiaj",
    clear: "Wyczyść",
    confirm: "Zatwierdź",
    cancel: "Anuluj",
  },
  de: {
    months: [
      "Januar", "Februar", "März", "April", "Mai", "Juni",
      "Juli", "August", "September", "Oktober", "November", "Dezember"
    ],
    monthsShort: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
    days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    daysShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    daysMin: ["S", "M", "D", "M", "D", "F", "S"],
    today: "Heute",
    clear: "Löschen",
    confirm: "Bestätigen",
    cancel: "Abbrechen",
  },
  en: {
    months: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    daysMin: ["S", "M", "T", "W", "T", "F", "S"],
    today: "Today",
    clear: "Clear",
    confirm: "Confirm",
    cancel: "Cancel",
  },
};

type SupportedLanguage = keyof typeof TRANSLATIONS;

// Mapowanie języka na locale dla natywnego pickera
const LOCALE_MAP: Record<SupportedLanguage, string> = {
  pl: "pl-PL",
  de: "de-DE",
  en: "en-US",
};

export default function LocalizedDatePicker({
  value,
  onChange,
  placeholder,
  label,
  minimumDate,
  maximumDate,
  required = false,
  clearable = true,
}: LocalizedDatePickerProps) {
  const { i18n, t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value || new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(value || new Date());

  const lang = (i18n.language as SupportedLanguage) || "de";
  const trans = TRANSLATIONS[lang] || TRANSLATIONS.de;
  const locale = LOCALE_MAP[lang] || "de-DE";

  // Formatowanie daty według języka
  const formatDate = (date: Date): string => {
    const day = date.getDate();
    const month = trans.months[date.getMonth()];
    const year = date.getFullYear();
    
    if (lang === "en") {
      return `${month} ${day}, ${year}`;
    }
    return `${day} ${month} ${year}`;
  };

  // Formatowanie krótkiej daty (dla wyświetlania w polu)
  const formatShortDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    
    if (lang === "en") {
      return `${month}/${day}/${year}`;
    }
    return `${day}.${month}.${year}`;
  };

  // Generowanie dni w miesiącu
  const generateCalendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: (Date | null)[] = [];
    
    // Dni z poprzedniego miesiąca (aby tydzień zaczynał się od poniedziałku)
    let startDay = firstDay.getDay();
    // Konwertuj niedzielę (0) na 7, aby tydzień zaczynał się od poniedziałku
    startDay = startDay === 0 ? 6 : startDay - 1;
    
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Dni bieżącego miesiąca
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentMonth]);

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date): boolean => {
    if (!tempDate) return false;
    return (
      date.getDate() === tempDate.getDate() &&
      date.getMonth() === tempDate.getMonth() &&
      date.getFullYear() === tempDate.getFullYear()
    );
  };

  const isDisabled = (date: Date): boolean => {
    if (minimumDate && date < minimumDate) return true;
    if (maximumDate && date > maximumDate) return true;
    return false;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleSelectDate = (date: Date) => {
    if (!isDisabled(date)) {
      setTempDate(date);
    }
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const handleClear = () => {
    onChange(null);
    setShowPicker(false);
  };

  const handleToday = () => {
    const today = new Date();
    setTempDate(today);
    setCurrentMonth(today);
  };

  const openPicker = () => {
    setTempDate(value || new Date());
    setCurrentMonth(value || new Date());
    setShowPicker(true);
  };

  // Dni tygodnia zaczynające się od poniedziałku
  const weekDays = [...trans.daysMin.slice(1), trans.daysMin[0]];

  // Dla natywnych platform (iOS/Android) używamy natywnego pickera
  if (Platform.OS === "ios") {
    return (
      <View>
        {label && (
          <Text style={styles.label}>
            {label} {required && <Text style={styles.required}>*</Text>}
          </Text>
        )}
        <TouchableOpacity style={styles.inputContainer} onPress={openPicker}>
          <Ionicons name="calendar-outline" size={20} color="#64748b" />
          <Text style={[styles.inputText, !value && styles.placeholder]}>
            {value ? formatDate(value) : placeholder || t("common.select_date")}
          </Text>
          {value && clearable && (
            <TouchableOpacity onPress={() => onChange(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <Modal visible={showPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.iosPickerCancel}>{trans.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={styles.iosPickerDone}>{trans.confirm}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => date && setTempDate(date)}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                locale={locale}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Dla Android i Web używamy własnego kalendarza
  return (
    <View>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      )}
      <TouchableOpacity style={styles.inputContainer} onPress={openPicker}>
        <Ionicons name="calendar-outline" size={20} color="#64748b" />
        <Text style={[styles.inputText, !value && styles.placeholder]}>
          {value ? formatDate(value) : placeholder || t("common.select_date")}
        </Text>
        {value && clearable && (
          <TouchableOpacity onPress={() => onChange(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowPicker(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarContainer}>
            {/* Header z nawigacją miesięcy */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                <Ionicons name="chevron-back" size={24} color="#1e293b" />
              </TouchableOpacity>
              <Text style={styles.monthYearText}>
                {trans.months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                <Ionicons name="chevron-forward" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            {/* Dni tygodnia */}
            <View style={styles.weekDaysRow}>
              {weekDays.map((day, index) => (
                <Text key={index} style={styles.weekDayText}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Kalendarz */}
            <View style={styles.daysGrid}>
              {generateCalendarDays.map((date, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCell,
                    date && isToday(date) && styles.todayCell,
                    date && isSelected(date) && styles.selectedCell,
                    date && isDisabled(date) && styles.disabledCell,
                  ]}
                  onPress={() => date && handleSelectDate(date)}
                  disabled={!date || isDisabled(date)}
                >
                  {date && (
                    <Text
                      style={[
                        styles.dayText,
                        isToday(date) && styles.todayText,
                        isSelected(date) && styles.selectedText,
                        isDisabled(date) && styles.disabledText,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Przyciski akcji */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.todayButton} onPress={handleToday}>
                <Text style={styles.todayButtonText}>{trans.today}</Text>
              </TouchableOpacity>
              
              <View style={styles.actionButtonsRight}>
                {clearable && (
                  <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                    <Text style={styles.clearButtonText}>{trans.clear}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                  <Text style={styles.confirmButtonText}>{trans.confirm}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: "#1e293b",
  },
  placeholder: {
    color: "#94a3b8",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    width: "90%",
    maxWidth: 360,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
  },
  weekDaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  weekDayText: {
    width: 40,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  todayCell: {
    backgroundColor: "#f1f5f9",
  },
  selectedCell: {
    backgroundColor: "#2563eb",
  },
  disabledCell: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    color: "#1e293b",
  },
  todayText: {
    fontWeight: "700",
    color: "#2563eb",
  },
  selectedText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  disabledText: {
    color: "#94a3b8",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  actionButtonsRight: {
    flexDirection: "row",
    gap: 8,
  },
  todayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#dc2626",
  },
  confirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  // iOS specific styles
  iosPickerContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    position: "absolute",
    bottom: 0,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  iosPickerCancel: {
    fontSize: 16,
    color: "#64748b",
  },
  iosPickerDone: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563eb",
  },
  iosPicker: {
    height: 200,
  },
});
