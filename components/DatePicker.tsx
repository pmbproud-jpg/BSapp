import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DatePickerProps {
  value: string; // format: YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Wybierz datę",
  minDate,
  maxDate,
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Formatuj datę do wyświetlenia
  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pl-PL", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Web - używa natywnego inputa date
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.inputWrapper}>
          <Ionicons name="calendar-outline" size={20} color="#64748b" style={styles.icon} />
          <input
            type="date"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            min={minDate}
            max={maxDate}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 15,
              color: value ? "#1e293b" : "#94a3b8",
              backgroundColor: "transparent",
              padding: "12px 0",
              cursor: "pointer",
            }}
          />
        </View>
      </View>
    );
  }

  // Mobile - własny picker (uproszczona wersja)
  // W pełnej wersji użyłbyś @react-native-community/datetimepicker
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.inputWrapper}
        onPress={() => setShowPicker(true)}
      >
        <Ionicons name="calendar-outline" size={20} color="#64748b" style={styles.icon} />
        <Text style={[styles.text, !value && styles.placeholder]}>
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#64748b" />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wybierz datę</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>
            
            {/* Prosty wybór dat - generuj ostatnie i przyszłe 2 lata */}
            <View style={styles.quickDates}>
              <Text style={styles.quickDatesTitle}>Szybki wybór:</Text>
              
              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => {
                  const today = new Date().toISOString().split("T")[0];
                  onChange(today);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.quickDateText}>📅 Dziś</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  onChange(tomorrow.toISOString().split("T")[0]);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.quickDateText}>📅 Jutro</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  onChange(nextWeek.toISOString().split("T")[0]);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.quickDateText}>📅 Za tydzień</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickDateBtn}
                onPress={() => {
                  const nextMonth = new Date();
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  onChange(nextMonth.toISOString().split("T")[0]);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.quickDateText}>📅 Za miesiąc</Text>
              </TouchableOpacity>
            </View>

            {/* Ręczne wpisanie */}
            <View style={styles.manualInput}>
              <Text style={styles.manualLabel}>Lub wpisz datę (RRRR-MM-DD):</Text>
              <input
                type="text"
                placeholder="np. 2025-06-15"
                defaultValue={value}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                    onChange(val);
                    setShowPicker(false);
                  }
                }}
                style={{
                  width: "100%",
                  padding: 12,
                  fontSize: 16,
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  marginTop: 8,
                }}
              />
            </View>

            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                onChange("");
                setShowPicker(false);
              }}
            >
              <Text style={styles.clearBtnText}>Wyczyść datę</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 15,
    color: "#1e293b",
  },
  placeholder: {
    color: "#94a3b8",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
  },
  quickDates: {
    marginBottom: 20,
  },
  quickDatesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 10,
  },
  quickDateBtn: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  quickDateText: {
    fontSize: 15,
    color: "#1e293b",
  },
  manualInput: {
    marginBottom: 20,
  },
  manualLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  clearBtn: {
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  clearBtnText: {
    color: "#dc2626",
    fontWeight: "600",
  },
});
