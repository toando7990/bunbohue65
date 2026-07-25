import type { Language } from "./translations";

export type UnitType = "weight" | "volume" | "serving";

interface UnitLabels {
  large: string;
  small: string;
  default: string;
}

const unitMap: Record<Language, Record<UnitType, UnitLabels>> = {
  vi: {
    weight: { large: "kg", small: "g", default: "g" },
    volume: { large: "l", small: "ml", default: "ml" },
    serving: { large: "phần", small: "phần", default: "phần" },
  },
  en: {
    weight: { large: "lb", small: "oz", default: "oz" },
    volume: { large: "cup", small: "fl oz", default: "fl oz" },
    serving: { large: "serving", small: "serving", default: "serving" },
  },
};

export function getUnitLabel(
  unit: UnitType,
  lang: Language,
  size: "large" | "small" | "default" = "default",
): string {
  return unitMap[lang][unit][size];
}
