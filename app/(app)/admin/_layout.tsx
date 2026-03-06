import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="database" />
      <Stack.Screen name="passwords" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="company" />
      <Stack.Screen name="updates" />
    </Stack>
  );
}
