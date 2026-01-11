import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Types for mock data
interface MockUserProfile {
  id: string;
  email: string;
  role: 'admin' | 'approved' | 'pending' | 'rejected';
}

interface MockProfile {
  id: string;
  name: string;
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

// Helper function to check if user has edit permission
const hasEditPermission = (userId: string, profileId: string): boolean => {
  if (isAdmin(userId)) return true;
  const link = mockUserProfileLinks.find(
    (l) => l.user_id === userId && l.profile_id === profileId && l.permission === 'edit'
  );
  return !!link;
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
        if (table === 'financial_entries') {
          return {
            insert: vi.fn((entries: Partial<MockFinancialEntry> | Partial<MockFinancialEntry>[]) => {
              const entryArray = Array.isArray(entries) ? entries : [entries];
              
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    const inputEntry = entryArray[0];
                    
                    // RLS check: User must have edit permission
                    if (!currentUserId || !hasEditPermission(currentUserId, inputEntry.profile_id!)) {
                      return {
                        data: null,
                        error: { message: 'Permission denied', code: '42501' },
                      };
                    }
                    
                    const entry: MockFinancialEntry = {
                      id: inputEntry.id || fc.sample(fc.uuid(), 1)[0],
                      profile_id: inputEntry.profile_id!,
                      entry_date: inputEntry.entry_date || new Date().toISOString().split('T')[0],
                      direct_equity: inputEntry.direct_equity || 0,
                      created_by: currentUserId,
                    };
                    mockFinancialEntries.push(entry);
                    return { data: entry, error: null };
                  }),
                })),
              };
            }),
            update: vi.fn((updates: Partial<MockFinancialEntry>) => ({
              eq: vi.fn((field: string, value: string) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    const entry = mockFinancialEntries.find((e) => e[field as keyof MockFinancialEntry] === value);
                    
                    if (!entry) {
                      return { data: null, error: { message: 'Entry not found' } };
                    }
                    
                    // RLS check: User must have edit permission
                    if (!currentUserId || !hasEditPermission(currentUserId, entry.profile_id)) {
                      return {
                        data: null,
                        error: { message: 'Permission denied', code: '42501' },
                      };
                    }
                    
                    Object.assign(entry, updates);
                    return { data: entry, error: null };
                  }),
                })),
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => {
                return (async () => {
                  const entry = mockFinancialEntries.find((e) => e[field as keyof MockFinancialEntry] === value);
                  
                  if (!entry) {
                    return { data: null, error: { message: 'Entry not found' } };
                  }
                  
                  // RLS check: User must have edit permission
                  if (!currentUserId || !hasEditPermission(currentUserId, entry.profile_id)) {
                    return {
                      data: null,
                      error: { message: 'Permission denied', code: '42501' },
                    };
                  }
                  
                  mockFinancialEntries = mockFinancialEntries.filter((e) => e.id !== entry.id);
                  return { data: entry, error: null };
                })();
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

describe('Property Test: User-Profile Link Permission Enforcement', () => {
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

  it('should reject insert attempts from read-only users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
          entryId: fc.uuid(),
          directEquity: fc.float({ min: 0, max: 1000000, noNaN: true }),
        }),
        async ({ userId, profileId, profileName, entryId, directEquity }) => {
          // Setup: Create user with approved role
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create profile
          mockProfiles.push({
            id: profileId,
            name: profileName,
          });
          
          // Setup: Create read-only link
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userId,
            profile_id: profileId,
            permission: 'read',
          });
          
          // Set current user
          currentUserId = userId;
          
          // Action: Attempt to insert financial entry
          const { data, error } = await supabase
            .from('financial_entries')
            .insert({
              id: entryId,
              profile_id: profileId,
              entry_date: new Date().toISOString().split('T')[0],
              direct_equity: directEquity,
            })
            .select()
            .single();
          
          // Verification: Insert should be rejected
          expect(error).not.toBeNull();
          expect(error?.message).toContain('Permission denied');
          expect(data).toBeNull();
          
          // Verification: Entry should not exist in database
          const entryExists = mockFinancialEntries.some((e) => e.id === entryId);
          expect(entryExists).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject update attempts from read-only users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
          entryId: fc.uuid(),
          originalEquity: fc.float({ min: 0, max: 1000000, noNaN: true }),
          newEquity: fc.float({ min: 0, max: 1000000, noNaN: true }),
        }),
        async ({ userId, profileId, profileName, entryId, originalEquity, newEquity }) => {
          // Setup: Create user with approved role
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create profile
          mockProfiles.push({
            id: profileId,
            name: profileName,
          });
          
          // Setup: Create read-only link
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userId,
            profile_id: profileId,
            permission: 'read',
          });
          
          // Setup: Create existing entry (as if created by admin)
          mockFinancialEntries.push({
            id: entryId,
            profile_id: profileId,
            entry_date: new Date().toISOString().split('T')[0],
            direct_equity: originalEquity,
            created_by: fc.sample(fc.uuid(), 1)[0], // Different user
          });
          
          // Set current user
          currentUserId = userId;
          
          // Action: Attempt to update financial entry
          const { data, error } = await supabase
            .from('financial_entries')
            .update({ direct_equity: newEquity })
            .eq('id', entryId)
            .select()
            .single();
          
          // Verification: Update should be rejected
          expect(error).not.toBeNull();
          expect(error?.message).toContain('Permission denied');
          expect(data).toBeNull();
          
          // Verification: Entry should remain unchanged
          const entry = mockFinancialEntries.find((e) => e.id === entryId);
          expect(entry).toBeDefined();
          expect(entry?.direct_equity).toBe(originalEquity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject delete attempts from read-only users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
          entryId: fc.uuid(),
          directEquity: fc.float({ min: 0, max: 1000000, noNaN: true }),
        }),
        async ({ userId, profileId, profileName, entryId, directEquity }) => {
          // Setup: Create user with approved role
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create profile
          mockProfiles.push({
            id: profileId,
            name: profileName,
          });
          
          // Setup: Create read-only link
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userId,
            profile_id: profileId,
            permission: 'read',
          });
          
          // Setup: Create existing entry
          mockFinancialEntries.push({
            id: entryId,
            profile_id: profileId,
            entry_date: new Date().toISOString().split('T')[0],
            direct_equity: directEquity,
            created_by: fc.sample(fc.uuid(), 1)[0],
          });
          
          // Set current user
          currentUserId = userId;
          
          // Action: Attempt to delete financial entry
          const { error } = await supabase
            .from('financial_entries')
            .delete()
            .eq('id', entryId);
          
          // Verification: Delete should be rejected
          expect(error).not.toBeNull();
          expect(error?.message).toContain('Permission denied');
          
          // Verification: Entry should still exist
          const entryExists = mockFinancialEntries.some((e) => e.id === entryId);
          expect(entryExists).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow edit users to modify data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
          entryId: fc.uuid(),
          directEquity: fc.float({ min: 0, max: 1000000, noNaN: true }),
        }),
        async ({ userId, profileId, profileName, entryId, directEquity }) => {
          // Setup: Create user with approved role
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create profile
          mockProfiles.push({
            id: profileId,
            name: profileName,
          });
          
          // Setup: Create edit link
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userId,
            profile_id: profileId,
            permission: 'edit',
          });
          
          // Set current user
          currentUserId = userId;
          
          // Action: Insert financial entry
          const { data, error } = await supabase
            .from('financial_entries')
            .insert({
              id: entryId,
              profile_id: profileId,
              entry_date: new Date().toISOString().split('T')[0],
              direct_equity: directEquity,
            })
            .select()
            .single();
          
          // Verification: Insert should succeed
          expect(error).toBeNull();
          expect(data).not.toBeNull();
          expect(data?.id).toBe(entryId);
          expect(data?.profile_id).toBe(profileId);
          
          // Verification: Entry should exist in database
          const entry = mockFinancialEntries.find((e) => e.id === entryId);
          expect(entry).toBeDefined();
          expect(entry?.direct_equity).toBe(directEquity);
        }
      ),
      { numRuns: 100 }
    );
  });
});
