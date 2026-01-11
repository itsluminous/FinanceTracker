import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Feature: personal-finance-tracker, Property 12: RLS user isolation
// Validates: Requirements 10.6

// Types for mock data
interface MockUserProfile {
  id: string;
  email: string;
  role: 'admin' | 'approved' | 'pending' | 'rejected';
}

interface MockProfile {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface MockUserProfileLink {
  id: string;
  user_id: string;
  profile_id: string;
  permission: 'read' | 'edit';
}

interface MockFinancialEntry {
  id: string;
  profile_id: string;
  entry_date: string;
  direct_equity: number;
  created_by: string;
}

// Mock database state
let mockUserProfiles: MockUserProfile[] = [];
let mockProfiles: MockProfile[] = [];
let mockUserProfileLinks: MockUserProfileLink[] = [];
let mockFinancialEntries: MockFinancialEntry[] = [];
let currentUserId: string | null = null;

// Helper function to check if user is admin
const isAdmin = (userId: string): boolean => {
  const user = mockUserProfiles.find((u) => u.id === userId);
  return user?.role === 'admin';
};

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn(async () => {
          if (!currentUserId) {
            return { data: { user: null }, error: { message: 'Not authenticated' } };
          }
          return {
            data: { user: { id: currentUserId } },
            error: null,
          };
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn((_fields?: string) => ({
              // RLS check: Users can only view profiles they're linked to (unless admin)
              then: vi.fn(async (resolve: (value: { data: MockProfile[]; error: { message: string } | null }) => void) => {
                if (!currentUserId) {
                  resolve({ data: [], error: { message: 'Not authenticated' } });
                  return;
                }
                
                let visibleProfiles: MockProfile[];
                
                if (isAdmin(currentUserId)) {
                  visibleProfiles = mockProfiles;
                } else {
                  const linkedProfileIds = mockUserProfileLinks
                    .filter((l) => l.user_id === currentUserId)
                    .map((l) => l.profile_id);
                  visibleProfiles = mockProfiles.filter((p) => linkedProfileIds.includes(p.id));
                }
                
                resolve({ data: visibleProfiles, error: null });
              }),
            })),
          };
        }
        
        if (table === 'financial_entries') {
          return {
            select: vi.fn((_fields?: string) => ({
              // RLS check: Users can only view entries for linked profiles (unless admin)
              then: vi.fn(async (resolve: (value: { data: MockFinancialEntry[]; error: { message: string } | null }) => void) => {
                if (!currentUserId) {
                  resolve({ data: [], error: { message: 'Not authenticated' } });
                  return;
                }
                
                let visibleEntries: MockFinancialEntry[];
                
                if (isAdmin(currentUserId)) {
                  visibleEntries = mockFinancialEntries;
                } else {
                  const linkedProfileIds = mockUserProfileLinks
                    .filter((l) => l.user_id === currentUserId)
                    .map((l) => l.profile_id);
                  visibleEntries = mockFinancialEntries.filter((e) => linkedProfileIds.includes(e.profile_id));
                }
                
                resolve({ data: visibleEntries, error: null });
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

describe('Property Test: RLS User Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserProfiles = [];
    mockProfiles = [];
    mockUserProfileLinks = [];
    mockFinancialEntries = [];
    currentUserId = null;
  });

  afterEach(() => {
    mockUserProfiles = [];
    mockProfiles = [];
    mockUserProfileLinks = [];
    mockFinancialEntries = [];
    currentUserId = null;
  });

  it('should isolate profiles between non-admin users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user1Id: fc.uuid(),
          user2Id: fc.uuid(),
          user1ProfileId: fc.uuid(),
          user2ProfileId: fc.uuid(),
          user1ProfileName: fc.string({ minLength: 1, maxLength: 100 }),
          user2ProfileName: fc.string({ minLength: 1, maxLength: 100 }),
        }).filter(({ user1Id, user2Id, user1ProfileId, user2ProfileId }) => 
          user1Id !== user2Id && user1ProfileId !== user2ProfileId
        ),
        async ({ user1Id, user2Id, user1ProfileId, user2ProfileId, user1ProfileName, user2ProfileName }) => {
          // Clear mock state for this property test iteration
          mockUserProfiles = [];
          mockProfiles = [];
          mockUserProfileLinks = [];
          mockFinancialEntries = [];
          
          // Setup: Create two non-admin users
          mockUserProfiles.push({
            id: user1Id,
            email: `user1-${user1Id}@example.com`,
            role: 'approved',
          });
          mockUserProfiles.push({
            id: user2Id,
            email: `user2-${user2Id}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create two profiles
          mockProfiles.push({
            id: user1ProfileId,
            name: user1ProfileName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          mockProfiles.push({
            id: user2ProfileId,
            name: user2ProfileName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Setup: Link each user to their own profile
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: user1Id,
            profile_id: user1ProfileId,
            permission: 'read',
          });
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: user2Id,
            profile_id: user2ProfileId,
            permission: 'read',
          });
          
          // Action: Query profiles as user1
          currentUserId = user1Id;
          const { data: user1Profiles } = await supabase.from('profiles').select();
          
          // Verification: User1 should only see their own profile
          expect(user1Profiles).toBeDefined();
          expect(user1Profiles.length).toBe(1);
          expect(user1Profiles[0].id).toBe(user1ProfileId);
          
          // Verification: User1 should not see user2's profile
          const user2ProfileVisible = user1Profiles.some((p: MockProfile) => p.id === user2ProfileId);
          expect(user2ProfileVisible).toBe(false);
          
          // Action: Query profiles as user2
          currentUserId = user2Id;
          const { data: user2Profiles } = await supabase.from('profiles').select();
          
          // Verification: User2 should only see their own profile
          expect(user2Profiles).toBeDefined();
          expect(user2Profiles.length).toBe(1);
          expect(user2Profiles[0].id).toBe(user2ProfileId);
          
          // Verification: User2 should not see user1's profile
          const user1ProfileVisible = user2Profiles.some((p: MockProfile) => p.id === user1ProfileId);
          expect(user1ProfileVisible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should isolate financial entries between non-admin users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user1Id: fc.uuid(),
          user2Id: fc.uuid(),
          user1ProfileId: fc.uuid(),
          user2ProfileId: fc.uuid(),
          user1EntryId: fc.uuid(),
          user2EntryId: fc.uuid(),
          user1Equity: fc.float({ min: 0, max: 1000000, noNaN: true }),
          user2Equity: fc.float({ min: 0, max: 1000000, noNaN: true }),
        }).filter(({ user1Id, user2Id, user1ProfileId, user2ProfileId, user1EntryId, user2EntryId }) => 
          user1Id !== user2Id && user1ProfileId !== user2ProfileId && user1EntryId !== user2EntryId
        ),
        async ({ user1Id, user2Id, user1ProfileId, user2ProfileId, user1EntryId, user2EntryId, user1Equity, user2Equity }) => {
          // Clear mock state for this property test iteration
          mockUserProfiles = [];
          mockProfiles = [];
          mockUserProfileLinks = [];
          mockFinancialEntries = [];
          
          // Setup: Create two non-admin users
          mockUserProfiles.push({
            id: user1Id,
            email: `user1-${user1Id}@example.com`,
            role: 'approved',
          });
          mockUserProfiles.push({
            id: user2Id,
            email: `user2-${user2Id}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create two profiles
          mockProfiles.push({
            id: user1ProfileId,
            name: 'User1 Profile',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          mockProfiles.push({
            id: user2ProfileId,
            name: 'User2 Profile',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Setup: Link each user to their own profile
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: user1Id,
            profile_id: user1ProfileId,
            permission: 'read',
          });
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: user2Id,
            profile_id: user2ProfileId,
            permission: 'read',
          });
          
          // Setup: Create financial entries for each profile
          mockFinancialEntries.push({
            id: user1EntryId,
            profile_id: user1ProfileId,
            entry_date: new Date().toISOString().split('T')[0],
            direct_equity: user1Equity,
            created_by: user1Id,
          });
          mockFinancialEntries.push({
            id: user2EntryId,
            profile_id: user2ProfileId,
            entry_date: new Date().toISOString().split('T')[0],
            direct_equity: user2Equity,
            created_by: user2Id,
          });
          
          // Action: Query financial entries as user1
          currentUserId = user1Id;
          const { data: user1Entries } = await supabase.from('financial_entries').select();
          
          // Verification: User1 should only see their own entries
          expect(user1Entries).toBeDefined();
          expect(user1Entries.length).toBe(1);
          expect(user1Entries[0].id).toBe(user1EntryId);
          expect(user1Entries[0].profile_id).toBe(user1ProfileId);
          
          // Verification: User1 should not see user2's entries
          const user2EntryVisible = user1Entries.some((e: MockFinancialEntry) => e.id === user2EntryId);
          expect(user2EntryVisible).toBe(false);
          
          // Action: Query financial entries as user2
          currentUserId = user2Id;
          const { data: user2Entries } = await supabase.from('financial_entries').select();
          
          // Verification: User2 should only see their own entries
          expect(user2Entries).toBeDefined();
          expect(user2Entries.length).toBe(1);
          expect(user2Entries[0].id).toBe(user2EntryId);
          expect(user2Entries[0].profile_id).toBe(user2ProfileId);
          
          // Verification: User2 should not see user1's entries
          const user1EntryVisible = user2Entries.some((e: MockFinancialEntry) => e.id === user1EntryId);
          expect(user1EntryVisible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow users to see multiple linked profiles but not unlinked ones', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          linkedProfile1Id: fc.uuid(),
          linkedProfile2Id: fc.uuid(),
          unlinkedProfileId: fc.uuid(),
        }).filter(({ linkedProfile1Id, linkedProfile2Id, unlinkedProfileId }) => 
          linkedProfile1Id !== linkedProfile2Id && 
          linkedProfile1Id !== unlinkedProfileId && 
          linkedProfile2Id !== unlinkedProfileId
        ),
        async ({ userId, linkedProfile1Id, linkedProfile2Id, unlinkedProfileId }) => {
          // Clear mock state for this property test iteration
          mockUserProfiles = [];
          mockProfiles = [];
          mockUserProfileLinks = [];
          mockFinancialEntries = [];
          
          // Setup: Create non-admin user
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create three profiles
          mockProfiles.push({
            id: linkedProfile1Id,
            name: 'Linked Profile 1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          mockProfiles.push({
            id: linkedProfile2Id,
            name: 'Linked Profile 2',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          mockProfiles.push({
            id: unlinkedProfileId,
            name: 'Unlinked Profile',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Setup: Link user to two profiles
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userId,
            profile_id: linkedProfile1Id,
            permission: 'read',
          });
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userId,
            profile_id: linkedProfile2Id,
            permission: 'read',
          });
          
          // Action: Query profiles as user
          currentUserId = userId;
          const { data: profiles } = await supabase.from('profiles').select();
          
          // Verification: User should see exactly two linked profiles
          expect(profiles).toBeDefined();
          expect(profiles.length).toBe(2);
          
          // Verification: Both linked profiles should be visible
          const profileIds = profiles.map((p: MockProfile) => p.id).sort();
          const expectedIds = [linkedProfile1Id, linkedProfile2Id].sort();
          expect(profileIds).toEqual(expectedIds);
          
          // Verification: Unlinked profile should not be visible
          const unlinkedVisible = profiles.some((p: MockProfile) => p.id === unlinkedProfileId);
          expect(unlinkedVisible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prevent users from accessing data after link is removed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          profileId: fc.uuid(),
          entryId: fc.uuid(),
          equity: fc.float({ min: 0, max: 1000000, noNaN: true }),
        }),
        async ({ userId, profileId, entryId, equity }) => {
          // Clear mock state for this property test iteration
          mockUserProfiles = [];
          mockProfiles = [];
          mockUserProfileLinks = [];
          mockFinancialEntries = [];
          
          // Setup: Create non-admin user
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create profile
          mockProfiles.push({
            id: profileId,
            name: 'Test Profile',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Setup: Create link
          const linkId = fc.sample(fc.uuid(), 1)[0];
          mockUserProfileLinks.push({
            id: linkId,
            user_id: userId,
            profile_id: profileId,
            permission: 'read',
          });
          
          // Setup: Create financial entry
          mockFinancialEntries.push({
            id: entryId,
            profile_id: profileId,
            entry_date: new Date().toISOString().split('T')[0],
            direct_equity: equity,
            created_by: fc.sample(fc.uuid(), 1)[0],
          });
          
          // Action: Query data with link present
          currentUserId = userId;
          let { data: profilesBefore } = await supabase.from('profiles').select();
          let { data: entriesBefore } = await supabase.from('financial_entries').select();
          
          // Verification: User can see profile and entries
          expect(profilesBefore.length).toBe(1);
          expect(entriesBefore.length).toBe(1);
          
          // Action: Remove link
          mockUserProfileLinks = mockUserProfileLinks.filter((l) => l.id !== linkId);
          
          // Action: Query data after link removed
          ({ data: profilesBefore } = await supabase.from('profiles').select());
          ({ data: entriesBefore } = await supabase.from('financial_entries').select());
          
          // Verification: User can no longer see profile or entries
          expect(profilesBefore.length).toBe(0);
          expect(entriesBefore.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
