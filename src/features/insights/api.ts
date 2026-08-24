import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PersonalInsights } from "@/types/models";

export function usePersonalInsights(from: string, to: string) {
  return useQuery({
    queryKey: ["personal-insights", from, to],
    enabled: Boolean(from && to),
    queryFn: async (): Promise<PersonalInsights> => {
      const { data, error } = await supabase.rpc("personal_insights", { p_from: from, p_to: to });
      if (error) throw error;
      return data as PersonalInsights;
    }
  });
}

export type RangePreset = {
  id: string;
  label: string;
  range: () => { from: string; to: string };
};

const iso = (date: Date) => date.toISOString().slice(0, 10);

export const RANGE_PRESETS: RangePreset[] = [
  {
    id: "this-month",
    label: "This month",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    }
  },
  {
    id: "last-month",
    label: "Last month",
    range: () => {
      const now = new Date();
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0))
      };
    }
  },
  {
    id: "3-months",
    label: "Last 3 months",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: iso(now) };
    }
  },
  {
    id: "this-year",
    label: "This year",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
    }
  }
];
