import { useMutation, useQueryClient, QueryKey } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface UseSupabaseMutateProps<TData = any> {
  table: string;
  method?: "insert" | "update" | "delete";
  queryKeysToInvalidate?: QueryKey[];
  onSuccess?: (data: TData) => void;
  onError?: (error: any) => void;
}

export function useSupabaseMutate<TBody = any, TData = any>({
  table,
  method = "insert",
  queryKeysToInvalidate = [],
  onSuccess,
  onError,
}: UseSupabaseMutateProps<TData>) {
  const queryClient = useQueryClient();

  return useMutation<TData, any, TBody>({
    mutationFn: async (body: any) => {
      let query: any;

      if (method === "insert") {
        query = supabase.from(table).insert(body).select();
      } else if (method === "update") {
        const { id, ...rest } = body;
        query = supabase.from(table).update(rest).eq("id", id).select();
      } else if (method === "delete") {
        query = supabase.from(table).delete().eq("id", body.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TData;
    },
    onSuccess: (data) => {
      queryKeysToInvalidate.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      onSuccess?.(data);
    },
    onError: (error) => {
      console.error("Supabase Mutation Error:", error);
      onError?.(error);
    },
  });
}
