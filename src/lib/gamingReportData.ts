export const SHIFTS = ["Opening", "Mid", "Night"] as const;

export const DEFECT_TYPES = [
  { key: "keyboard", label: "Keyboards", storeKey: "defective_keyboards" },
  { key: "mouse", label: "Mice", storeKey: "defective_mice" },
  { key: "headset", label: "Headsets", storeKey: "defective_headsets" },
  { key: "monitor", label: "Monitors", storeKey: "defective_monitors" },
] as const;

export type DefectKey = (typeof DEFECT_TYPES)[number]["key"];

export const PERIPHERAL_CATEGORIES = [
  { key: "keyboard", label: "Keyboards" },
  { key: "mouse", label: "Mice" },
  { key: "headset", label: "Headsets" },
  { key: "monitor", label: "Monitors" },
] as const;

export type PeripheralKey = (typeof PERIPHERAL_CATEGORIES)[number]["key"];

export interface GamingConfig {
  standard_pcs: string[];
  vip_pcs: string[];
  games: string[];
  game_statuses: string[];
  shift_pcs: Record<string, string[]>;
  spare_types: string[];
  peripheral_brands: Record<string, string[]>;
}

export function mergeConfig(raw: any): GamingConfig {
  const parse = (v: any, fallback: any) => {
    if (v == null) return fallback;
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return fallback;
      }
    }
    return v;
  };

  return {
    standard_pcs: parse(raw?.standardPcs ?? raw?.standard_pcs, []),
    vip_pcs: parse(raw?.vipPcs ?? raw?.vip_pcs, []),
    games: parse(raw?.games, []),
    game_statuses: parse(raw?.gameStatuses ?? raw?.game_statuses, [
      "Online",
      "Offline",
      "Maintenance",
      "Updated",
    ]),
    shift_pcs: parse(raw?.shiftPcs ?? raw?.shift_pcs, {
      Opening: [],
      Mid: [],
      Night: [],
    }),
    spare_types: parse(raw?.spareTypes ?? raw?.spare_types, []),
    peripheral_brands: parse(raw?.peripheralBrands ?? raw?.peripheral_brands, {}),
  };
}

export function buildPeripheralCounts(
  cfg: GamingConfig,
  existing: Record<string, Array<{ brand: string; quantity: string | number }>> | null
) {
  const result: Record<string, Array<{ brand: string; quantity: string | number }>> = {};
  for (const { key } of PERIPHERAL_CATEGORIES) {
    const brands =
      cfg.peripheral_brands[key] ||
      cfg.peripheral_brands[key + "s"] ||
      [];
    const prev = existing?.[key] || [];
    result[key] = brands.map((brand) => {
      const found = prev.find((x) => x.brand === brand);
      return { brand, quantity: found?.quantity ?? 0 };
    });
  }
  return result;
}

export function buildSpareItems(
  spareTypes: string[],
  existing:
    | Array<{ item_type: string; quantity: number }>
    | Record<string, number>
    | null
    | undefined
) {
  const map: Record<string, number> = {};
  if (Array.isArray(existing)) {
    for (const row of existing) map[row.item_type] = Number(row.quantity) || 0;
  } else if (existing && typeof existing === "object") {
    for (const [k, v] of Object.entries(existing)) map[k] = Number(v) || 0;
  }
  const result: Record<string, number> = {};
  for (const t of spareTypes) result[t] = map[t] ?? 0;
  return result;
}

export function toneForStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("online") || s.includes("updated") || s.includes("ok"))
    return "bg-emerald-600";
  if (s.includes("offline")) return "bg-slate-500";
  if (s.includes("maintenance") || s.includes("repair")) return "bg-amber-500";
  if (s.includes("update") || s.includes("required") || s.includes("check"))
    return "bg-blue-600";
  return "bg-navy-700";
}

export function emptyDefects(): Record<
  DefectKey,
  Array<{ pc: string; brand: string; note: string }>
> {
  return DEFECT_TYPES.reduce(
    (acc, t) => {
      acc[t.key] = [];
      return acc;
    },
    {} as Record<DefectKey, Array<{ pc: string; brand: string; note: string }>>
  );
}

/** Normalize no_defect_pcs whether stored as array or { standard, vip }. */
export function noDefectList(reportData: any): string[] {
  const nd = reportData?.no_defect_pcs;
  if (!nd) return [];
  if (Array.isArray(nd)) return nd;
  return [...(nd.standard || []), ...(nd.vip || [])];
}
