export type Profile = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  default_currency: string;
};

export type GroupRole = "owner" | "member";

export type Group = {
  id: string;
  name: string;
  icon: string;
  default_currency: string;
  created_by: string;
  created_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  profile: Profile;
};

export type Invite = {
  token: string;
  group_id: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
  created_at: string;
};

export type InvitePreview = {
  group_id: string;
  group_name: string;
  group_icon: string;
  member_count: number;
  already_member: boolean;
};

export type Category = {
  id: string;
  group_id: string | null;
  name: string;
  icon: string;
};

export type SplitMethod = "equal" | "exact" | "percent" | "shares";

export type ExpensePayer = {
  user_id: string;
  amount_minor: number;
};

export type ExpenseShare = {
  user_id: string;
  share_amount_minor: number;
  share_percent: number | null;
  share_units: number | null;
};

export type Expense = {
  id: string;
  group_id: string;
  description: string;
  category_id: string | null;
  total_amount_minor: number;
  currency: string;
  split_method: SplitMethod;
  expense_date: string;
  receipt_url: string | null;
  created_by: string;
  created_at: string;
  category: Category | null;
  payers: ExpensePayer[];
  shares: ExpenseShare[];
};

/** Positive: the group owes them. Negative: they owe the group. */
export type Balance = {
  user_id: string;
  net_minor: number;
};

export type SimplifiedDebt = {
  from_user: string;
  to_user: string;
  amount_minor: number;
};

export type Settlement = {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount_minor: number;
  currency: string;
  note: string | null;
  settled_at: string;
};

export type InsightsTotal = {
  currency: string;
  share_minor: number;
  paid_minor: number;
  expense_count: number;
};

export type InsightsCategorySlice = {
  currency: string;
  category_id: string | null;
  name: string;
  icon: string;
  share_minor: number;
  expense_count: number;
};

export type InsightsGroupSlice = {
  currency: string;
  group_id: string;
  name: string;
  icon: string;
  share_minor: number;
  expense_count: number;
};

export type InsightsMonthSlice = {
  currency: string;
  month: string;
  share_minor: number;
};

export type InsightsExpense = {
  expense_id: string;
  description: string;
  expense_date: string;
  currency: string;
  share_amount_minor: number;
  group_name: string;
  group_icon: string;
  category_name: string;
  category_icon: string;
};

export type PersonalInsights = {
  from: string;
  to: string;
  totals: InsightsTotal[];
  by_category: InsightsCategorySlice[];
  by_group: InsightsGroupSlice[];
  by_month: InsightsMonthSlice[];
  expenses: InsightsExpense[];
};

export type ExpenseFilters = {
  categoryId?: string | null;
  memberId?: string | null;
  from?: string | null;
  to?: string | null;
};
