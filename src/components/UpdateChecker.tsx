import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { useTranslation } from "react-i18next";

export default function UpdateChecker() {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web" || checked) return;

    const checkForUpdate = async () => {
      try {
        const Updates = await import("expo-updates");
        if (!Updates.isEnabled) return;

        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            t("updates.title", "Aktualizacja dostępna"),
            t("updates.message", "Dostępna jest nowa wersja aplikacji. Czy chcesz zaktualizować teraz?"),
            [
              {
                text: t("common.cancel", "Później"),
                style: "cancel",
              },
              {
                text: t("updates.update_now", "Aktualizuj"),
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (e) {
                    console.error("Error fetching update:", e);
                  }
                },
              },
            ]
          );
        }
      } catch (e) {
        console.log("Update check skipped:", e);
      } finally {
        setChecked(true);
      }
    };

    checkForUpdate();
  }, [checked]);

  return null;
}
