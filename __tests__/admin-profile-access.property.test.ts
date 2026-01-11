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
  created_at: string;
  updated_at: string;
}

interface MockUserProfileLink {
  id: string;
  user_id: string;
  profile_id: string;
  permission: 'read' | 'edit';
}

// Mock database state
let mockUserProfiles: MockUserProfile[] = [];
let mockProfiles: MockProfile[] = [];
let mockUserProfileLinks: MockUserProfileLink[] = [];
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
            select: vi.fn(() => ({
              // RLS check: Admin can view all profiles, non-admin can only view linked profiles
              then: vi.fn(async (resolve: (value: { data: MockProfile[]; error: { message: string } | null }) => void) => {
                if (!currentUserId) {
                  resolve({ data: [], error: { message: 'Not authenticated' } });
                  return;
                }
                
                let visibleProfiles: MockProfile[];
                
                if (isAdmin(currentUserId)) {
                  // Admin can see all profiles
                  visibleProfiles = mockProfiles;
                } else {
                  // Non-admin can only see linked profiles
                  const linkedProfileIds = mockUserProfileLinks
                    .filter((l) => l.user_id === currentUserId)
                    .map((l) => l.profile_id);
                  visibleProfiles = mockProfiles.filter((p) => linkedProfileIds.includes(p.id));
                }
                
                resolve({ data: visibleProfiles, error: null });
              }),
            })),
            insert: vi.fn((profiles: Partial<MockProfile> | Partial<MockProfile>[]) => {
              const profileArray = Array.isArray(profiles) ? profiles : [profiles];
              
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    const inputProfile = profileArray[0];
                    
                    // RLS check: Only admin and approved users can create profiles
                    if (!currentUserId) {
                      return { data: null, error: { message: 'Not authenticated' } };
                    }
                    
                    const user = mockUserProfiles.find((u) => u.id === currentUserId);
                    if (!user || (user.role !== 'admin' && user.role !== 'approved')) {
                      return {
                        data: null,
                        error: { message: 'Permission denied', code: '42501' },
                      };
                    }
                    
                    const profile: MockProfile = {
                      id: inputProfile.id || fc.sample(fc.uuid(), 1)[0],
                      name: inputProfile.name !== undefined ? inputProfile.name : '',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };
                    mockProfiles.push(profile);
                    return { data: profile, error: null };
                  }),
                })),
              };
            }),
            update: vi.fn((updates: Partial<MockProfile>) => ({
              eq: vi.fn((field: string, value: string) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    const profile = mockProfiles.find((p) => p[field as keyof MockProfile] === value);
                    
                    if (!profile) {
                      return { data: null, error: { message: 'Profile not found' } };
                    }
                    
                    // RLS check: Only admin can update profiles
                    if (!currentUserId || !isAdmin(currentUserId)) {
                      return {
                        data: null,
                        error: { message: 'Permission denied', code: '42501' },
                      };
                    }
                    
                    Object.assign(profile, updates, { updated_at: new Date().toISOString() });
                    return { data: profile, error: null };
                  }),
                })),
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => {
                return (async () => {
                  const profile = mockProfiles.find((p) => p[field as keyof MockProfile] === value);
                  
                  if (!profile) {
                    return { data: null, error: { message: 'Profile not found' } };
                  }
                  
                  // RLS check: Only admin can delete profiles
                  if (!currentUserId || !isAdmin(currentUserId)) {
                    return {
                      data: null,
                      error: { message: 'Permission denied', code: '42501' },
                    };
                  }
                  
                  mockProfiles = mockProfiles.filter((p) => p.id !== profile.id);
                  return { data: profile, error: null };
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

describe('Property Test: Admin Profile Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserProfiles = [];
    mockProfiles = [];
    mockUserProfileLinks = [];
    currentUserId = null;
  });

  afterEach(() => {
    mockUserProfiles = [];
    mockProfiles = [];
    mockUserProfileLinks = [];
    currentUserId = null;
  });

  it('should allow admin to view all profiles regardless of links', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.uuid(),
          profiles: fc.array(
            fc.record({
              profileId: fc.uuid(),
              profileName: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        async ({ adminId, profiles }) => {
          // Clear state for this iteration
          mockUserProfiles = [];
          mockProfiles = [];
          mockUserProfileLinks = [];
          currentUserId = null;
          
          // Setup: Create admin user
          mockUserProfiles.push({
            id: adminId,
            email: `admin-${adminId}@example.com`,
            role: 'admin',
          });
          
          // Setup: Create multiple profiles without linking to admin
          for (const { profileId, profileName } of profiles) {
            mockProfiles.push({
              id: profileId,
              name: profileName,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          
          // Verify: No links exist for admin
          const adminLinks = mockUserProfileLinks.filter((l) => l.user_id === adminId);
          expect(adminLinks.length).toBe(0);
          
          // Set current user to admin
          currentUserId = adminId;
          
          // Action: Query all profiles as admin
          const { data, error } = await supabase.from('profiles').select();
          
          // Verification: Admin should see all profiles
          expect(error).toBeNull();
          expect(data).toBeDefined();
          expect(data.length).toBe(profiles.length);
          
          // Verification: All profile IDs should be present
          const returnedIds = data.map((p: MockProfile) => p.id).sort();
          const expectedIds = profiles.map((p) => p.profileId).sort();
          expect(returnedIds).toEqual(expectedIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow admin to update any profile', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.uuid(),
          profileId: fc.uuid(),
          originalName: fc.string({ minLength: 1, maxLength: 100 }),
          newName: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ adminId, profileId, originalName, newName }) => {
          // Clear state for this iteration
          mockUserProfiles = [];
          mockProfiles = [];
          mockUserProfileLinks = [];
          currentUserId = null;
          
          // Setup: Create admin user
          mockUserProfiles.push({
            id: adminId,
            email: `admin-${adminId}@example.com`,
            role: 'admin',
          });
          
          // Setup: Create profile without linking to admin
          mockProfiles.push({
            id: profileId,
            name: originalName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Set current user to admin
          currentUserId = adminId;
          
          // Action: Update profile as admin
          const { data, error } = await supabase
            .from('profiles')
            .update({ name: newName })
            .eq('id', profileId)
            .select()
            .single();
          
          // Verification: Update should succeed
          expect(error).toBeNull();
          expect(data).not.toBeNull();
          expect(data?.name).toBe(newName);
          
          // Verification: Profile should be updated in database
          const profile = mockProfiles.find((p) => p.id === profileId);
          expect(profile).toBeDefined();
          expect(profile?.name).toBe(newName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow admin to delete any profile', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.uuid(),
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ adminId, profileId, profileName }) => {
          // Clear state for this iteration
          mockUserProfiles = [];
          mockProfiles = [];
          mockUserProfileLinks = [];
          currentUserId = null;
          
          // Setup: Create admin user
          mockUserProfiles.push({
            id: adminId,
            email: `admin-${adminId}@example.com`,
            role: 'admin',
          });
          
          // Setup: Create profile without linking to admin
          mockProfiles.push({
            id: profileId,
            name: profileName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Set current user to admin
          currentUserId = adminId;
          
          // Action: Delete profile as admin
          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', profileId);
          
          // Verification: Delete should succeed
          expect(error).toBeNull();
          
          // Verification: Profile should be removed from database
          const profileExists = mockProfiles.some((p) => p.id === profileId);
          expect(profileExists).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prevent non-admin users from viewing unlinked profiles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          linkedProfileId: fc.uuid(),
          unlinkedProfileId: fc.uuid(),
          linkedProfileName: fc.string({ minLength: 1, maxLength: 100 }),
          unlinkedProfileName: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ userId, linkedProfileId, unlinkedProfileId, linkedProfileName, unlinkedProfileName }) => {
          // Clear state for this iteration
          mockUserProfiles = [];
          mockProfiles = [];
          mockUserProfileLinks = [];
          currentUserId = null;
          
          // Setup: Create non-admin user
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create two profiles
          mockProfiles.push({
            id: linkedProfileId,
            name: linkedProfileName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          mockProfiles.push({
            id: unlinkedProfileId,
            name: unlinkedProfileName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Setup: Link user to only one profile
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userId,
            profile_id: linkedProfileId,
            permission: 'read',
          });
          
          // Set current user to non-admin
          currentUserId = userId;
          
          // Action: Query all profiles as non-admin
          const { data, error } = await supabase.from('profiles').select();
          
          // Verification: Non-admin should only see linked profile
          expect(error).toBeNull();
          expect(data).toBeDefined();
          expect(data.length).toBe(1);
          expect(data[0].id).toBe(linkedProfileId);
          
          // Verification: Unlinked profile should not be visible
          const unlinkedVisible = data.some((p: MockProfile) => p.id === unlinkedProfileId);
          expect(unlinkedVisible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prevent non-admin users from updating profiles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          profileId: fc.uuid(),
          originalName: fc.string({ minLength: 1, maxLength: 100 }),
          newName: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ userId, profileId, originalName, newName }) => {
          // Clear state for this iteration
          mockUserProfiles = [];
          mockProfiles = [];
          mockUserProfileLinks = [];
          currentUserId = null;
          
          // Setup: Create non-admin user
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'approved',
          });
          
          // Setup: Create profile and link to user with edit permission
          mockProfiles.push({
            id: profileId,
            name: originalName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          mockUserProfileLinks.push({
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userId,
            profile_id: profileId,
            permission: 'edit',
          });
          
          // Set current user to non-admin
          currentUserId = userId;
          
          // Action: Attempt to update profile as non-admin
          const { data, error } = await supabase
            .from('profiles')
            .update({ name: newName })
            .eq('id', profileId)
            .select()
            .single();
          
          // Verification: Update should be rejected
          expect(error).not.toBeNull();
          expect(error?.message).toContain('Permission denied');
          expect(data).toBeNull();
          
          // Verification: Profile should remain unchanged
          const profile = mockProfiles.find((p) => p.id === profileId);
          expect(profile).toBeDefined();
          expect(profile?.name).toBe(originalName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
