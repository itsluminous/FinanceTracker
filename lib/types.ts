// High and medium risk asset categories
export interface HighMediumRiskAssets {
  direct_equity: number;
  esops: number;
  equity_pms: number;
  ulip: number;
  real_estate: number;
  real_estate_funds: number;
  private_equity: number;
  equity_mutual_funds: number;
  structured_products_equity: number;
}

// Low risk asset categories
export interface LowRiskAssets {
  bank_balance: number;
  debt_mutual_funds: number;
  endowment_plans: number;
  fixed_deposits: number;
  nps: number;
  epf: number;
  ppf: number;
  structured_products_debt: number;
  gold_etfs_funds: number;
}

// Complete financial entry
export interface FinancialEntry {
  id: string; // UUID
  profile_id: string; // FK to profiles
  entry_date: Date;
  high_medium_risk: HighMediumRiskAssets;
  low_risk: LowRiskAssets;
  total_high_medium_risk: number; // Calculated
  total_low_risk: number; // Calculated
  total_assets: number; // Calculated
  created_at: Date;
  updated_at: Date;
  created_by: string; // FK to auth.users
}

// Chart data for analytics
export interface ChartDataPoint {
  date: string;
  total_assets: number;
  high_medium_risk: number;
  low_risk: number;
}

export interface RiskDistribution {
  name: string;
  value: number;
  percentage: number;
}

// User profile types
export type UserRole = 'admin' | 'approved' | 'pending' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}
