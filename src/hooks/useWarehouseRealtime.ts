/**
 * Realtime subskrypcje dla widoku magazynu (magazyn.tsx).
 * Sluchana globalnych zmian w warehouse_items, warehouse_materials
 * oraz wszystkich zamowieniach (projekty wszystkie razem -- magazyn-wide).
 *
 * Faza 3.5 roadmapy.
 */
import { useSupabaseRealtime } from "./useSupabaseRealtime";
import { warehouseKeys } from "./useProjectOrders";
import { warehouseToolsKey } from "./useWarehouseTools";
import { warehouseOrdersKey } from "./useWarehouseOrders";

export function useWarehouseRealtime() {
  // Narzedzia (raw + enriched -- oba klucze)
  useSupabaseRealtime({
    channel: "warehouse-items",
    table: "warehouse_items",
    invalidateKeys: [warehouseKeys.tools(), warehouseToolsKey],
  });

  // Materialy
  useSupabaseRealtime({
    channel: "warehouse-materials",
    table: "warehouse_materials",
    invalidateKeys: [warehouseKeys.materials()],
  });

  // Wszystkie zamowienia materialowe (agregat magazyn-wide)
  useSupabaseRealtime({
    channel: "warehouse-material-orders",
    table: "project_material_orders",
    invalidateKeys: [warehouseOrdersKey],
  });

  // Wszystkie zamowienia narzedziowe
  useSupabaseRealtime({
    channel: "warehouse-tool-orders",
    table: "project_tool_orders",
    invalidateKeys: [warehouseOrdersKey],
  });
}
