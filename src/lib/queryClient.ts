/**
 * QueryClient dla TanStack Query v5.
 * Konfiguracja dopasowana do React Native + Expo + Supabase.
 *
 * Faza 3 roadmapy: zastapienie recznych loadX() po kazdej mutacji
 * przez useQuery + invalidateQueries.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 minut zanim dane uznawane sa za stale (i auto-refetch przy mount)
      staleTime: 5 * 60 * 1000,
      // 10 minut przed garbage-collection nieaktywnych zapytan
      gcTime: 10 * 60 * 1000,
      // Mobile: zwykle nie chcemy refetch przy zmianie focusa okna -- aplikacja
      // ma juz useFocusEffect w wielu miejscach. Realtime (Faza 3.5) bedzie
      // robic invalidate aktywnie.
      refetchOnWindowFocus: false,
      // Sieć w mobile bywa przerywana -- jeden retry zamiast 3 domyslnych
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
    mutations: {
      // Mutacje nie retry-ujemy automatycznie -- user widzi blad i sam decyduje
      retry: 0,
    },
  },
});
