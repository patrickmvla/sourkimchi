// - Scaling quantities
// - Metric/Imperial conversions (mass, volume)
// - Picking "nice" display units for a target system
// - Formatting quantities as mixed fractions (for cooking-friendly display)

export type Unit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "tsp"
  | "tbsp"
  | "cup"
  | "oz"
  | "lb"
  | "piece"
  | "clove"
  | "pinch"
  | "dash";

export type UnitSystem = "metric" | "imperial";

type UnitFamily = "mass" | "volume" | "count" | "unknown";

const MASS_UNITS: readonly Unit[] = ["g", "kg", "oz", "lb"];
const VOLUME_UNITS: readonly Unit[] = ["ml", "l", "tsp", "tbsp", "cup"];
const COUNT_UNITS: readonly Unit[] = ["piece", "clove", "pinch", "dash"];

// Base factors (to grams / to milliliters)
// Note: ml<->cup uses 240 ml per cup (common cooking convention; US legal is ~240ml)
const TO_GRAMS: Record<Extract<Unit, "g" | "kg" | "oz" | "lb">, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

const TO_ML: Record<
  Extract<Unit, "ml" | "l" | "tsp" | "tbsp" | "cup">,
  number
> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
};

// Synonyms -> canonical units (best-effort, helpful when normalizing)
const CANON: Record<string, Unit> = {
  // mass
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  // volume
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  tblsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  // count
  piece: "piece",
  pieces: "piece",
  clove: "clove",
  cloves: "clove",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
};

export function normalizeUnit(u?: string | null): Unit | undefined {
  if (!u) return undefined;
  const k = u.trim().toLowerCase().replace(/[.,]/g, "");
  return CANON[k] ?? undefined;
}

export function unitFamilyOf(u?: Unit | null): UnitFamily {
  if (!u) return "unknown";
  if ((MASS_UNITS as readonly string[]).includes(u)) return "mass";
  if ((VOLUME_UNITS as readonly string[]).includes(u)) return "volume";
  if ((COUNT_UNITS as readonly string[]).includes(u)) return "count";
  return "unknown";
}

export function canConvertUnits(from?: Unit | null, to?: Unit | null): boolean {
  if (!from || !to) return false;
  const f = unitFamilyOf(from);
  return f !== "count" && f !== "unknown" && f === unitFamilyOf(to);
}

// Convert between units within the same family (mass or volume).
// Returns null if not convertible.
export function convertUnit(
  quantity: number,
  from: Unit,
  to: Unit
): number | null {
  const family = unitFamilyOf(from);
  if (family !== unitFamilyOf(to)) return null;

  if (family === "mass") {
    const grams = quantity * TO_GRAMS[from as keyof typeof TO_GRAMS];
    return grams / TO_GRAMS[to as keyof typeof TO_GRAMS];
  }
  if (family === "volume") {
    const ml = quantity * TO_ML[from as keyof typeof TO_ML];
    return ml / TO_ML[to as keyof typeof TO_ML];
  }
  // count or unknown
  return null;
}

// Choose a "nice" display unit for the target system (metric/imperial)
// and convert quantity accordingly. Returns original if not convertible.
export function toPreferredUnit(
  quantity: number | undefined,
  unit: Unit | undefined,
  system: UnitSystem,
  opts: {
    preferLarger?: boolean; // If true, bias toward larger units
    roundStep?: number; // e.g., 0.25 for quarters
  } = {}
): { quantity: number | undefined; unit: Unit | undefined } {
  if (typeof quantity !== "number" || !unit) return { quantity, unit };
  const family = unitFamilyOf(unit);

  // Count-like units are left as-is.
  if (family === "count" || family === "unknown") return { quantity, unit };

  const roundStep = opts.roundStep ?? 0.01;

  if (family === "mass") {
    // Work in grams
    const grams = convertUnit(quantity, unit, "g")!;
    if (system === "metric") {
      // Prefer kg when >= 1000g (or prefer larger flag)
      if (grams >= 1000 || (opts.preferLarger && grams >= 500)) {
        return { quantity: roundTo(grams / 1000, roundStep), unit: "kg" };
      }
      return { quantity: roundTo(grams, roundStep), unit: "g" };
    } else {
      // imperial: use lb when >= ~0.75 lb, else oz
      const pounds = grams / TO_GRAMS.lb;
      if (pounds >= 0.75) {
        return { quantity: roundTo(pounds, roundStep), unit: "lb" };
      }
      const ounces = grams / TO_GRAMS.oz;
      return { quantity: roundTo(ounces, roundStep), unit: "oz" };
    }
  }

  if (family === "volume") {
    // Work in ml
    const ml = convertUnit(quantity, unit, "ml")!;
    if (system === "metric") {
      if (ml >= 1000 || (opts.preferLarger && ml >= 500)) {
        return { quantity: roundTo(ml / 1000, roundStep), unit: "l" };
      }
      return { quantity: roundTo(ml, roundStep), unit: "ml" };
    } else {
      // imperial: choose among cup, tbsp, tsp
      const cups = ml / TO_ML.cup;
      if (cups >= 1) return { quantity: roundTo(cups, 0.125), unit: "cup" }; // eighth-cup precision
      const tbsp = ml / TO_ML.tbsp;
      if (tbsp >= 1) return { quantity: roundTo(tbsp, 0.25), unit: "tbsp" }; // quarter tbsp
      const tsp = ml / TO_ML.tsp;
      return { quantity: roundTo(tsp, 0.25), unit: "tsp" }; // quarter tsp
    }
  }

  return { quantity, unit };
}

// Simple scaler (keeps undefineds intact)
export function scaleQuantity(
  q: number | undefined,
  factor: number
): number | undefined {
  if (typeof q !== "number" || !isFinite(q)) return q;
  return q * factor;
}

// Format helpers

// Convert a decimal to a cooking-friendly mixed fraction string.
// e.g., 1.5 -> "1 1/2", 0.25 -> "1/4". Supports unicode or ascii fractions.
export function formatQuantity(
  value: number | undefined,
  opts: {
    maxDenominator?: 2 | 3 | 4 | 8;
    useUnicodeFractions?: boolean;
    trimZeros?: boolean; // show "1" instead of "1.00"
  } = {}
): string {
  if (typeof value !== "number" || !isFinite(value)) return "";
  const trimZeros = opts.trimZeros ?? true;
  const maxD = opts.maxDenominator ?? 8;

  const whole = Math.trunc(value);
  let frac = Math.abs(value - whole);

  // Snap small values close to integer
  if (Math.abs(frac) < 1e-6) frac = 0;

  if (frac === 0) return trimZeros ? String(whole) : value.toFixed(2);

  // Find best fraction numerator/denominator
  const DENOMS = [2, 3, 4, 8].filter((d) => d <= maxD);
  let best = { d: 1, n: 0, err: Infinity };
  for (const d of DENOMS) {
    const n = Math.round(frac * d);
    const err = Math.abs(frac - n / d);
    if (err < best.err && n !== 0) best = { d, n, err };
  }
  // Correct rollover like 3.99/4 -> whole + 1
  if (best.n === best.d) {
    return String(whole + (value >= 0 ? 1 : -1));
  }

  const fractionAscii = `${best.n}/${best.d}`;
  const fractionUnicode = UNICODE_FRACTIONS[fractionAscii] ?? fractionAscii;

  const fracStr = opts.useUnicodeFractions ? fractionUnicode : fractionAscii;
  if (whole === 0) return value < 0 ? `-${fracStr}` : fracStr;
  return `${whole} ${fracStr}`;
}

// Map ascii fraction -> unicode single-char where available
const UNICODE_FRACTIONS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
};

// Pluralization for display
export function pluralizeUnit(u: Unit, qty: number): string {
  const abs = Math.abs(qty);
  const isOne = abs === 1;
  switch (u) {
    case "cup":
      return isOne ? "cup" : "cups";
    case "piece":
      return isOne ? "piece" : "pieces";
    case "clove":
      return isOne ? "clove" : "cloves";
    case "pinch":
      return isOne ? "pinch" : "pinches";
    case "dash":
      return isOne ? "dash" : "dashes";
    // Abbreviations typically don't pluralize in cooking displays
    case "tsp":
    case "tbsp":
    case "g":
    case "kg":
    case "ml":
    case "l":
    case "oz":
    case "lb":
    default:
      return u;
  }
}

// Format "quantity + unit" nicely.
// Options:
// - targetSystem: convert to metric/imperial preference and choose a "nice" unit
// - unicodeFractions: 1/2 -> ½
export function formatMeasure(
  quantity: number | undefined,
  unit: Unit | undefined,
  opts: {
    targetSystem?: UnitSystem;
    preferLarger?: boolean;
    unicodeFractions?: boolean;
    maxDenominator?: 2 | 3 | 4 | 8;
  } = {}
): string {
  if (quantity == null && !unit) return "";
  let q = quantity;
  let u = unit;

  if (opts.targetSystem && q != null && u) {
    const conv = toPreferredUnit(q, u, opts.targetSystem, {
      preferLarger: opts.preferLarger,
    });
    q = conv.quantity;
    u = conv.unit;
  }

  const qtyStr =
    q == null
      ? ""
      : formatQuantity(q, {
          maxDenominator: opts.maxDenominator ?? 8,
          useUnicodeFractions: opts.unicodeFractions ?? true,
        });

  if (!u) return qtyStr;
  const unitStr = q != null ? pluralizeUnit(u, q) : u;
  return qtyStr ? `${qtyStr} ${unitStr}` : unitStr;
}

// Convenience: convert & format in one shot (mass/volume only)
export function convertAndFormat(
  quantity: number | undefined,
  unit: Unit | undefined,
  system: UnitSystem,
  opts?: Omit<Parameters<typeof formatMeasure>[2], "targetSystem">
): string {
  return formatMeasure(quantity, unit, {
    ...(opts ?? {}),
    targetSystem: system,
  });
}

// Rounding helper
export function roundTo(n: number, step = 0.01): number {
  if (!isFinite(n)) return n;
  return Math.round(n / step) * step;
}

// Example utilities you might use elsewhere:

// Convert to metric defaults (kg/g, l/ml)
export function toMetric(quantity: number | undefined, unit: Unit | undefined) {
  return toPreferredUnit(quantity ?? 0, unit, "metric");
}

// Convert to imperial defaults (lb/oz, cup/tbsp/tsp)
export function toImperial(
  quantity: number | undefined,
  unit: Unit | undefined
) {
  return toPreferredUnit(quantity ?? 0, unit, "imperial");
}

// Example: scale + convert + format
export function scaledMeasure(
  baseQty: number | undefined,
  unit: Unit | undefined,
  scale: number,
  target: UnitSystem,
  opts?: Omit<Parameters<typeof formatMeasure>[2], "targetSystem">
): string {
  const q = scaleQuantity(baseQty, scale);
  return formatMeasure(q, unit, { ...(opts ?? {}), targetSystem: target });
}
