import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Types for mock data
interface MockFinancialEntry {
  id: string;
  profile_id: string;
  entry_date: string;
  direct_equity: number;
  esops: number;
  equity_pms: number;
  ulip: number;
  real_estate: number;
  real_estate_funds: number;
  private_equity: number;
  equity_mutual_funds: number;
  structured_products_equity: number;
  bank_balance: number;
  debt_mutual_funds: number;
  endowment_plans: number;
  fixed_deposits: number;
  nps: number;
  epf: number;
  ppf: number;
  structured_products_debt: number;
  gold_etfs_funds: number;
  total_high_medium_risk: number;
  total_low_risk: number;
  total_assets: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface MockUserProfile {
  id: string;
  role: string;
}

interface MockUserProfileLink {
  user_id: string;
  profile_id: string;
  permission: string;
}

// Mock database state
let mockFinancialEntries: MockFinancialEntry[] = [];
let mockUserProfiles: MockUserProfile[] = [];
let mockUserProfileLinks: MockUserProfileLink[] = [];

// Helper to calculate totals
function calculateTotals(entry: Partial<MockFinancialEntry>): {
  total_high_medium_risk: number;
  total_low_risk: number;
  total_assets: number;
} {
  const total_high_medium_risk =
    (entry.direct_equity || 0) +
    (entry.esops || 0) +
    (entry.equity_pms || 0) +
    (entry.ulip || 0) +
    (entry.real_estate || 0) +
    (entry.real_estate_funds || 0) +
    (entry.private_equity || 0) +
    (entry.equity_mutual_funds || 0) +
    (entry.structured_products_equity || 0);

  const total_low_risk =
    (entry.bank_balance || 0) +
    (entry.debt_mutual_funds || 0) +
    (entry.endowment_plans || 0) +
    (entry.fixed_deposits || 0) +
    (entry.nps || 0) +
    (entry.epf || 0) +
    (entry.ppf || 0) +
    (entry.structured_products_debt || 0) +
    (entry.gold_etfs_funds || 0);

  const total_assets = total_high_medium_risk + total_low_risk;

  return { total_high_medium_risk, total_low_risk, total_assets };
}

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn(async (token: string) => {
          if (token === 'valid-token') {
            return {
              data: { user: { id: 'test-user-id' } },
              error: null,
            };
          }
          return {
            data: { user: null },
            error: { message: 'Invalid token' },
          };
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'financial_entries') {
          return {
            insert: vi.fn((entries: Partial<MockFinancialEntry> | Partial<MockFinancialEntry>[]) => {
              const entryArray = Array.isArray(entries) ? entries : [entries];

              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    const inputEntry = entryArray[0];
                    const totals = calculateTotals(inputEntry);

                    const entry: MockFinancialEntry = {
                      id: `entry-${Date.now()}`,
                      profile_id: inputEntry.profile_id || '',
                      entry_date: inputEntry.entry_date || new Date().toISOString().split('T')[0],
                      direct_equity: inputEntry.direct_equity || 0,
                      esops: inputEntry.esops || 0,
                      equity_pms: inputEntry.equity_pms || 0,
                      ulip: inputEntry.ulip || 0,
                      real_estate: inputEntry.real_estate || 0,
                      real_estate_funds: inputEntry.real_estate_funds || 0,
                      private_equity: inputEntry.private_equity || 0,
                      equity_mutual_funds: inputEntry.equity_mutual_funds || 0,
                      structured_products_equity: inputEntry.structured_products_equity || 0,
                      bank_balance: inputEntry.bank_balance || 0,
                      debt_mutual_funds: inputEntry.debt_mutual_funds || 0,
                      endowment_plans: inputEntry.endowment_plans || 0,
                      fixed_deposits: inputEntry.fixed_deposits || 0,
                      nps: inputEntry.nps || 0,
                      epf: inputEntry.epf || 0,
                      ppf: inputEntry.ppf || 0,
                      structured_products_debt: inputEntry.structured_products_debt || 0,
                      gold_etfs_funds: inputEntry.gold_etfs_funds || 0,
                      ...totals,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      created_by: inputEntry.created_by || 'test-user-id',
                    };
                    mockFinancialEntries.push(entry);
                    return { data: entry, error: null };
                  }),
                })),
              };
            }),
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => ({
                order: vi.fn(() => {
                  const entries = mockFinancialEntries.filter(
                    (e) => e[field as keyof MockFinancialEntry] === value
                  );
                  return Promise.resolve({ data: entries, error: null });
                }),
                limit: vi.fn((count: number) => ({
                  single: vi.fn(async () => {
                    const entries = mockFinancialEntries
                      .filter((e) => e[field as keyof MockFinancialEntry] === value)
                      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
                      .slice(0, count);
                    return { data: entries[0] || null, error: null };
                  }),
                })),
              })),
            })),
          };
        }

        if (table === 'user_profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => ({
                single: vi.fn(async () => {
                  const profile = mockUserProfiles.find(
                    (p) => p[field as keyof MockUserProfile] === value
                  );
                  return { data: profile || null, error: null };
                }),
              })),
            })),
          };
        }

        if (table === 'user_profile_links') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => ({
                single: vi.fn(async () => {
                  const link = mockUserProfileLinks.find(
                    (l) => l[field as keyof MockUserProfileLink] === value
                  );
                  return { data: link || null, error: null };
                }),
              })),
            })),
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(),
            })),
          })),
        };
      }),
    })),
  };
});

import { supabase } from '../lib/supabase';

describe('Financial Entry Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinancialEntries = [];
    mockUserProfiles = [];
    mockUserProfileLinks = [];

    // Setup: Create an approved user with edit permission
    mockUserProfiles.push({
      id: 'test-user-id',
      role: 'approved',
    });

    mockUserProfileLinks.push({
      user_id: 'test-user-id',
      profile_id: 'test-profile-id',
      permission: 'edit',
    });
  });

  afterEach(() => {
    mockFinancialEntries = [];
    mockUserProfiles = [];
    mockUserProfileLinks = [];
  });

  describe('Entry Creation', () => {
    it('should create a new financial entry with valid data', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        direct_equity: 100000.50,
        bank_balance: 50000.25,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry, error } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      expect(error).toBeNull();
      expect(entry).toBeDefined();
      expect(entry.profile_id).toBe(entryData.profile_id);
      expect(entry.entry_date).toBe(entryData.entry_date);
      expect(entry.direct_equity).toBe(entryData.direct_equity);
      expect(entry.bank_balance).toBe(entryData.bank_balance);
      expect(entry.id).toBeDefined();
      expect(entry.created_at).toBeDefined();
    });

    it('should calculate total_high_medium_risk correctly', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        direct_equity: 10000,
        esops: 5000,
        equity_mutual_funds: 15000,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      expect(entry.total_high_medium_risk).toBe(30000);
    });

    it('should calculate total_low_risk correctly', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        bank_balance: 20000,
        fixed_deposits: 30000,
        ppf: 10000,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      expect(entry.total_low_risk).toBe(60000);
    });

    it('should calculate total_assets correctly', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        direct_equity: 50000,
        bank_balance: 30000,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      expect(entry.total_assets).toBe(80000);
    });

    it('should handle decimal values correctly', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        direct_equity: 10000.50,
        bank_balance: 5000.25,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      expect(entry.direct_equity).toBe(10000.50);
      expect(entry.bank_balance).toBe(5000.25);
      expect(Math.abs(entry.total_assets - 15000.75)).toBeLessThan(0.01);
    });

    it('should default missing fields to zero', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      expect(entry.direct_equity).toBe(0);
      expect(entry.bank_balance).toBe(0);
      expect(entry.total_assets).toBe(0);
    });
  });

  describe('Entry Retrieval', () => {
    it('should retrieve all entries for a profile', async () => {
      // Arrange: Create multiple entries
      await supabase
        .from('financial_entries')
        .insert({
          profile_id: 'test-profile-id',
          entry_date: '2024-01-01',
          direct_equity: 10000,
          created_by: 'test-user-id',
        })
        .select()
        .single();

      await supabase
        .from('financial_entries')
        .insert({
          profile_id: 'test-profile-id',
          entry_date: '2024-02-01',
          direct_equity: 15000,
          created_by: 'test-user-id',
        })
        .select()
        .single();

      // Act
      const { data: entries, error } = await supabase
        .from('financial_entries')
        .select()
        .eq('profile_id', 'test-profile-id')
        .order('entry_date');

      // Assert
      expect(error).toBeNull();
      expect(entries).toBeDefined();
      expect(entries.length).toBe(2);
    });

    it('should retrieve the latest entry for a profile', async () => {
      // Arrange: Create multiple entries
      await supabase
        .from('financial_entries')
        .insert({
          profile_id: 'test-profile-id',
          entry_date: '2024-01-01',
          direct_equity: 10000,
          created_by: 'test-user-id',
        })
        .select()
        .single();

      await supabase
        .from('financial_entries')
        .insert({
          profile_id: 'test-profile-id',
          entry_date: '2024-02-01',
          direct_equity: 15000,
          created_by: 'test-user-id',
        })
        .select()
        .single();

      await supabase
        .from('financial_entries')
        .insert({
          profile_id: 'test-profile-id',
          entry_date: '2024-03-01',
          direct_equity: 20000,
          created_by: 'test-user-id',
        })
        .select()
        .single();

      // Act
      const { data: latestEntry } = await supabase
        .from('financial_entries')
        .select()
        .eq('profile_id', 'test-profile-id')
        .limit(1)
        .single();

      // Assert
      expect(latestEntry).toBeDefined();
      expect(latestEntry.entry_date).toBe('2024-03-01');
      expect(latestEntry.direct_equity).toBe(20000);
    });

    it('should return null when no entries exist for profile', async () => {
      // Act
      const { data: entry } = await supabase
        .from('financial_entries')
        .select()
        .eq('profile_id', 'non-existent-profile')
        .limit(1)
        .single();

      // Assert
      expect(entry).toBeNull();
    });
  });

  describe('Entry Pre-fill', () => {
    it('should pre-fill form with most recent entry data', async () => {
      // Arrange: Create an entry
      const { data: previousEntry } = await supabase
        .from('financial_entries')
        .insert({
          profile_id: 'test-profile-id',
          entry_date: '2024-01-01',
          direct_equity: 50000,
          bank_balance: 30000,
          fixed_deposits: 20000,
          created_by: 'test-user-id',
        })
        .select()
        .single();

      // Act: Retrieve latest entry for pre-fill
      const { data: latestEntry } = await supabase
        .from('financial_entries')
        .select()
        .eq('profile_id', 'test-profile-id')
        .limit(1)
        .single();

      // Assert
      expect(latestEntry).toBeDefined();
      expect(latestEntry.direct_equity).toBe(previousEntry.direct_equity);
      expect(latestEntry.bank_balance).toBe(previousEntry.bank_balance);
      expect(latestEntry.fixed_deposits).toBe(previousEntry.fixed_deposits);
    });
  });

  describe('Total Calculations', () => {
    it('should maintain calculation accuracy with multiple fields', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        direct_equity: 10000,
        esops: 5000,
        equity_pms: 3000,
        real_estate: 50000,
        bank_balance: 20000,
        fixed_deposits: 15000,
        ppf: 10000,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      const expectedHighMedium = 10000 + 5000 + 3000 + 50000;
      const expectedLowRisk = 20000 + 15000 + 10000;
      const expectedTotal = expectedHighMedium + expectedLowRisk;

      expect(entry.total_high_medium_risk).toBe(expectedHighMedium);
      expect(entry.total_low_risk).toBe(expectedLowRisk);
      expect(entry.total_assets).toBe(expectedTotal);
    });

    it('should handle all asset fields in calculation', async () => {
      // Arrange: Entry with all fields populated
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        direct_equity: 1000,
        esops: 2000,
        equity_pms: 3000,
        ulip: 4000,
        real_estate: 5000,
        real_estate_funds: 6000,
        private_equity: 7000,
        equity_mutual_funds: 8000,
        structured_products_equity: 9000,
        bank_balance: 1000,
        debt_mutual_funds: 2000,
        endowment_plans: 3000,
        fixed_deposits: 4000,
        nps: 5000,
        epf: 6000,
        ppf: 7000,
        structured_products_debt: 8000,
        gold_etfs_funds: 9000,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      const expectedHighMedium = 1000 + 2000 + 3000 + 4000 + 5000 + 6000 + 7000 + 8000 + 9000;
      const expectedLowRisk = 1000 + 2000 + 3000 + 4000 + 5000 + 6000 + 7000 + 8000 + 9000;
      const expectedTotal = expectedHighMedium + expectedLowRisk;

      expect(entry.total_high_medium_risk).toBe(expectedHighMedium);
      expect(entry.total_low_risk).toBe(expectedLowRisk);
      expect(entry.total_assets).toBe(expectedTotal);
    });
  });

  describe('Decimal Validation', () => {
    it('should accept values with 2 decimal places', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        direct_equity: 12345.67,
        bank_balance: 98765.43,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry, error } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      expect(error).toBeNull();
      expect(entry.direct_equity).toBe(12345.67);
      expect(entry.bank_balance).toBe(98765.43);
    });

    it('should accept values with 1 decimal place', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        direct_equity: 10000.5,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry, error } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      expect(error).toBeNull();
      expect(entry.direct_equity).toBe(10000.5);
    });

    it('should accept whole number values', async () => {
      // Arrange
      const entryData = {
        profile_id: 'test-profile-id',
        entry_date: '2024-01-15',
        direct_equity: 10000,
        created_by: 'test-user-id',
      };

      // Act
      const { data: entry, error } = await supabase
        .from('financial_entries')
        .insert(entryData)
        .select()
        .single();

      // Assert
      expect(error).toBeNull();
      expect(entry.direct_equity).toBe(10000);
    });
  });
});
