import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Balance,
  Category,
  Expense,
  ExpenseFilters,
  ExpensePayer,
  ExpenseShare,
  Settlement,
  SimplifiedDebt,
  SplitMethod
} from "@/types/models";

const EXPENSE_COLUMNS = `
  id, group_id, description, category_id, total_amount_minor, currency,
  split_method, expense_date, receipt_url, created_by, created_at,
  category:categories(id, group_id, name, icon),
  payers:expense_payers(user_id, amount_minor),
  shares:expense_shares(user_id, share_amount_minor, share_percent, share_units)
`;

/** Global defaults (group_id null) plus this group's own categories. */
export function useCategories(groupId: string | undefined) {
  return useQuery({
    queryKey: ["categories", groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, group_id, name, icon")
        .or(`group_id.is.null,group_id.eq.${groupId}`)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Category[];
    }
  });
}

export function useCreateCategory(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; icon: string }) => {
      const { data, error } = await supabase
        .from("categories")
        .insert({ group_id: groupId, name: input.name.trim(), icon: input.icon })
        .select("id, group_id, name, icon")
        .single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", groupId] })
  });
}

export function useExpenses(groupId: string | undefined, filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: ["expenses", groupId, filters],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Expense[]> => {
      let query = supabase
        .from("expenses")
        .select(EXPENSE_COLUMNS)
        .eq("group_id", groupId!)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
      if (filters.from) query = query.gte("expense_date", filters.from);
      if (filters.to) query = query.lte("expense_date", filters.to);

      const { data, error } = await query;
      if (error) throw error;

      const rows = data as unknown as Expense[];

      // Member filter means "this person was involved" — as a payer or a participant — which
      // PostgREST can't express against embedded rows, so it's applied here.
      if (!filters.memberId) return rows;
      return rows.filter(
        (expense) =>
          expense.payers.some((p) => p.user_id === filters.memberId) ||
          expense.shares.some((s) => s.user_id === filters.memberId)
      );
    }
  });
}

export function useCreateExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      description: string;
      totalMinor: number;
      splitMethod: SplitMethod;
      categoryId: string | null;
      expenseDate: string;
      payers: ExpensePayer[];
      shares: ExpenseShare[];
    }) => {
      const { data, error } = await supabase.rpc("create_expense", {
        p_group_id: groupId,
        p_description: input.description,
        p_total_amount_minor: input.totalMinor,
        p_split_method: input.splitMethod,
        p_payers: input.payers,
        p_shares: input.shares,
        p_category_id: input.categoryId,
        p_expense_date: input.expenseDate
      });
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => invalidateGroupMoney(queryClient, groupId)
  });
}

export function useDeleteExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => invalidateGroupMoney(queryClient, groupId)
  });
}

export function useBalances(groupId: string | undefined) {
  return useQuery({
    queryKey: ["balances", groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Balance[]> => {
      const { data, error } = await supabase.rpc("group_balances", { p_group_id: groupId });
      if (error) throw error;
      return (data as Balance[]) ?? [];
    }
  });
}

export function useSimplifiedDebts(groupId: string | undefined) {
  return useQuery({
    queryKey: ["simplified-debts", groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<SimplifiedDebt[]> => {
      const { data, error } = await supabase.rpc("simplify_debts", { p_group_id: groupId });
      if (error) throw error;
      return (data as SimplifiedDebt[]) ?? [];
    }
  });
}

export function useSettleUp(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { toUser: string; amountMinor: number; note?: string }) => {
      const { data, error } = await supabase.rpc("settle_up", {
        p_group_id: groupId,
        p_to_user: input.toUser,
        p_amount_minor: input.amountMinor,
        p_note: input.note ?? null
      });
      if (error) throw error;
      return data as Settlement;
    },
    onSuccess: () => invalidateGroupMoney(queryClient, groupId)
  });
}

export function useSettlements(groupId: string | undefined) {
  return useQuery({
    queryKey: ["settlements", groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Settlement[]> => {
      const { data, error } = await supabase
        .from("settlements")
        .select("id, group_id, from_user, to_user, amount_minor, currency, note, settled_at")
        .eq("group_id", groupId!)
        .order("settled_at", { ascending: false });
      if (error) throw error;
      return data as Settlement[];
    }
  });
}

/** Any money write invalidates the expense list and both balance views together. */
function invalidateGroupMoney(queryClient: ReturnType<typeof useQueryClient>, groupId: string) {
  queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
  queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
  queryClient.invalidateQueries({ queryKey: ["simplified-debts", groupId] });
  queryClient.invalidateQueries({ queryKey: ["settlements", groupId] });
}
