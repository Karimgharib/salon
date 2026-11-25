import { useQuery, QueryKey } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const OPERATORS = ["gte", "lte", "gt", "lt", "like", "ilike", "neq"] as const;

interface UseSupabaseQueryProps {
  table: string;
  queryKey: QueryKey;
  select?: string;
  filters?: Record<string, any>;
  orderBy?: { column: string; asc?: boolean };
  single?: boolean;
  in?: { column: string; values: any[] };
  enabled?: boolean;
}

export function useSupabaseQuery<T = any>({
  table,
  queryKey,
  select = "*",
  filters = {},
  orderBy,
  single = false,
  in: inFilter,
  enabled = true,
}: UseSupabaseQueryProps) {
  return useQuery<T>({
    queryKey,
    enabled,
    queryFn: async () => {
      let query: any = supabase.from(table).select(select);

      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) continue;

        const parts = key.split(".");
        const lastPart = parts[parts.length - 1];

        if (OPERATORS.includes(lastPart as any)) {
          // مثال: "start_time.gte" -> query.gte("start_time", value)
          const column = parts.slice(0, -1).join(".");
          query = query[lastPart](column, value);
        } else {
          query = query.eq(key, value);
        }
      }

      if (inFilter) {
        query = query.in(inFilter.column, inFilter.values);
      }

      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.asc ?? true });
      }

      if (single) query = query.single();

      const { data, error } = await query;
      if (error) throw error;
      return data as T;
    },
  });
}
