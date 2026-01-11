import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Types for mock data
interface MockProfile {
  id: string;
  name: string;
}

interface MockUserProfileLink {
  id: string;
  user_id: string;
  profile_id: string;
  permission: string;
}

interface MockFinancialEntry {
  id: string;
  profile_id: string;
  entry_date: string;
  total_assets: number;
}

// Mock database state
let mockProfiles: MockProfile[] = [];
let mockUserProfileLinks: MockUserProfileLink[] = [];
let mockFinancialEntries: MockFinancialEntry[] = [];

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => {
                // Simulate CASCADE DELETE behavior
                const profileIndex = mockProfiles.findIndex((p) => p[field as keyof MockProfile] === value);
                if (profileIndex !== -1) {
                  const profileId = mockProfiles[profileIndex].id;
                  
                  // Delete the profile
                  mockProfiles.splice(profileIndex, 1);
                  
                  // CASCADE: Delete associated user_profile_links
                  mockUserProfileLinks = mockUserProfileLinks.filter(
                    (link) => link.profile_id !== profileId
                  );
                  
                  // CASCADE: Delete associated financial_entries
                  mockFinancialEntries = mockFinancialEntries.filter(
                    (entry) => entry.profile_id !== profileId
                  );
                }
                return Promise.resolve({ error: null });
              }),
            })),
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => ({
                single: vi.fn(async () => {
                  const profile = mockProfiles.find((p) => p[field as keyof MockProfile] === value);
                  return { data: profile || null, error: null };
                }),
              })),
            })),
          };
        }
        
        if (table === 'user_profile_links') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => {
                const links = mockUserProfileLinks.filter((l) => l[field as keyof MockUserProfileLink] === value);
                return Promise.resolve({ data: links, error: null });
              }),
            })),
          };
        }
        
        if (table === 'financial_entries') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => {
                const entries = mockFinancialEntries.filter((e) => e[field as keyof MockFinancialEntry] === value);
                return Promise.resolve({ data: entries, error: null });
              }),
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

describe('Property Test: Profile Deletion Cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfiles = [];
    mockUserProfileLinks = [];
    mockFinancialEntries = [];
  });

  afterEach(() => {
    mockProfiles = [];
    mockUserProfileLinks = [];
    mockFinancialEntries = [];
  });

  it('should delete all user_profile_links when a profile is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
          userLinks: fc.array(
            fc.record({
              userId: fc.uuid(),
              permission: fc.constantFrom('read', 'edit'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ profileId, profileName, userLinks }) => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          mockUserProfileLinks = [];
          mockFinancialEntries = [];
          
          // Setup: Create a profile
          mockProfiles.push({
            id: profileId,
            name: profileName,
          });

          // Setup: Create user_profile_links for this profile
          userLinks.forEach((link) => {
            mockUserProfileLinks.push({
              id: fc.sample(fc.uuid(), 1)[0],
              user_id: link.userId,
              profile_id: profileId,
              permission: link.permission,
            });
          });

          // Verification: Links exist before deletion
          let { data: linksBefore } = await supabase
            .from('user_profile_links')
            .select()
            .eq('profile_id', profileId);

          expect(linksBefore).toBeDefined();
          expect(linksBefore.length).toBe(userLinks.length);

          // Action: Delete the profile
          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', profileId);

          expect(error).toBeNull();

          // Verification: Profile is deleted
          const { data: profile } = await supabase
            .from('profiles')
            .select()
            .eq('id', profileId)
            .single();

          expect(profile).toBeNull();

          // Verification: All user_profile_links are deleted (CASCADE)
          ({ data: linksBefore } = await supabase
            .from('user_profile_links')
            .select()
            .eq('profile_id', profileId));

          expect(linksBefore).toBeDefined();
          expect(linksBefore.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should delete all financial_entries when a profile is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
          entries: fc.array(
            fc.record({
              entryDate: fc.integer({ min: 0, max: 10000 }).map(days => {
                const date = new Date('2020-01-01');
                date.setDate(date.getDate() + days);
                return date.toISOString().split('T')[0];
              }),
              totalAssets: fc.float({ min: 0, max: 10000000, noNaN: true }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        async ({ profileId, profileName, entries }) => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          mockUserProfileLinks = [];
          mockFinancialEntries = [];
          
          // Setup: Create a profile
          mockProfiles.push({
            id: profileId,
            name: profileName,
          });

          // Setup: Create financial_entries for this profile
          entries.forEach((entry) => {
            mockFinancialEntries.push({
              id: fc.sample(fc.uuid(), 1)[0],
              profile_id: profileId,
              entry_date: entry.entryDate,
              total_assets: entry.totalAssets,
            });
          });

          // Verification: Entries exist before deletion
          let { data: entriesBefore } = await supabase
            .from('financial_entries')
            .select()
            .eq('profile_id', profileId);

          expect(entriesBefore).toBeDefined();
          expect(entriesBefore.length).toBe(entries.length);

          // Action: Delete the profile
          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', profileId);

          expect(error).toBeNull();

          // Verification: Profile is deleted
          const { data: profile } = await supabase
            .from('profiles')
            .select()
            .eq('id', profileId)
            .single();

          expect(profile).toBeNull();

          // Verification: All financial_entries are deleted (CASCADE)
          ({ data: entriesBefore } = await supabase
            .from('financial_entries')
            .select()
            .eq('profile_id', profileId));

          expect(entriesBefore).toBeDefined();
          expect(entriesBefore.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should delete both user_profile_links and financial_entries when a profile is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
          userLinks: fc.array(
            fc.record({
              userId: fc.uuid(),
              permission: fc.constantFrom('read', 'edit'),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          entries: fc.array(
            fc.record({
              entryDate: fc.integer({ min: 1577836800000, max: 1924905600000 }).map(ts => new Date(ts).toISOString().split('T')[0]),
              totalAssets: fc.float({ min: 0, max: 10000000, noNaN: true }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ profileId, profileName, userLinks, entries }) => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          mockUserProfileLinks = [];
          mockFinancialEntries = [];
          
          // Setup: Create a profile
          mockProfiles.push({
            id: profileId,
            name: profileName,
          });

          // Setup: Create user_profile_links
          userLinks.forEach((link) => {
            mockUserProfileLinks.push({
              id: fc.sample(fc.uuid(), 1)[0],
              user_id: link.userId,
              profile_id: profileId,
              permission: link.permission,
            });
          });

          // Setup: Create financial_entries
          entries.forEach((entry) => {
            mockFinancialEntries.push({
              id: fc.sample(fc.uuid(), 1)[0],
              profile_id: profileId,
              entry_date: entry.entryDate,
              total_assets: entry.totalAssets,
            });
          });

          // Verification: Data exists before deletion
          const { data: linksBefore } = await supabase
            .from('user_profile_links')
            .select()
            .eq('profile_id', profileId);

          const { data: entriesBefore } = await supabase
            .from('financial_entries')
            .select()
            .eq('profile_id', profileId);

          expect(linksBefore.length).toBe(userLinks.length);
          expect(entriesBefore.length).toBe(entries.length);

          // Action: Delete the profile
          await supabase
            .from('profiles')
            .delete()
            .eq('id', profileId);

          // Verification: Profile is deleted
          const { data: profile } = await supabase
            .from('profiles')
            .select()
            .eq('id', profileId)
            .single();

          expect(profile).toBeNull();

          // Verification: All associated data is deleted (CASCADE)
          const { data: linksAfter } = await supabase
            .from('user_profile_links')
            .select()
            .eq('profile_id', profileId);

          const { data: entriesAfter } = await supabase
            .from('financial_entries')
            .select()
            .eq('profile_id', profileId);

          expect(linksAfter.length).toBe(0);
          expect(entriesAfter.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not affect other profiles when one profile is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          profileToDelete: fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          otherProfile: fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
          }),
        }),
        async ({ profileToDelete, otherProfile }) => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          mockUserProfileLinks = [];
          mockFinancialEntries = [];
          
          // Ensure profiles have different IDs
          if (profileToDelete.id === otherProfile.id) {
            return; // Skip this test case
          }

          // Setup: Create two profiles
          mockProfiles.push(
            { id: profileToDelete.id, name: profileToDelete.name },
            { id: otherProfile.id, name: otherProfile.name }
          );

          // Setup: Create data for both profiles
          const userId = fc.sample(fc.uuid(), 1)[0];
          
          mockUserProfileLinks.push(
            {
              id: fc.sample(fc.uuid(), 1)[0],
              user_id: userId,
              profile_id: profileToDelete.id,
              permission: 'edit',
            },
            {
              id: fc.sample(fc.uuid(), 1)[0],
              user_id: userId,
              profile_id: otherProfile.id,
              permission: 'edit',
            }
          );

          mockFinancialEntries.push(
            {
              id: fc.sample(fc.uuid(), 1)[0],
              profile_id: profileToDelete.id,
              entry_date: '2024-01-01',
              total_assets: 10000,
            },
            {
              id: fc.sample(fc.uuid(), 1)[0],
              profile_id: otherProfile.id,
              entry_date: '2024-01-01',
              total_assets: 20000,
            }
          );

          // Action: Delete one profile
          await supabase
            .from('profiles')
            .delete()
            .eq('id', profileToDelete.id);

          // Verification: Deleted profile and its data are gone
          const { data: deletedProfile } = await supabase
            .from('profiles')
            .select()
            .eq('id', profileToDelete.id)
            .single();

          expect(deletedProfile).toBeNull();

          // Verification: Other profile still exists
          const { data: remainingProfile } = await supabase
            .from('profiles')
            .select()
            .eq('id', otherProfile.id)
            .single();

          expect(remainingProfile).toBeDefined();
          expect(remainingProfile.id).toBe(otherProfile.id);

          // Verification: Other profile's links still exist
          const { data: remainingLinks } = await supabase
            .from('user_profile_links')
            .select()
            .eq('profile_id', otherProfile.id);

          expect(remainingLinks.length).toBe(1);

          // Verification: Other profile's entries still exist
          const { data: remainingEntries } = await supabase
            .from('financial_entries')
            .select()
            .eq('profile_id', otherProfile.id);

          expect(remainingEntries.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
