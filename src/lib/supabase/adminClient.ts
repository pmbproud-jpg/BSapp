/**
 * @deprecated — Ten plik NIE powinien być już używany.
 *
 * Migracja zakończona: wszystkie operacje admin przechodzą teraz przez
 * bezpieczny proxy Netlify Function (/.netlify/functions/supabase-admin).
 *
 * Zamiast tego importuj:
 *   import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
 *
 * Ten plik istnieje tylko jako backward-compatible re-export.
 */
import { adminApi } from "./adminApi";

/** @deprecated Użyj adminApi z ./adminApi */
export const supabaseAdmin = adminApi;
