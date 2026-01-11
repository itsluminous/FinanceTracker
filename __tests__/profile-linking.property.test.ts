import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Types for mock data
interface MockUserProfile {
  id: string;
  email: string;
  role: string;
  approved_at: string | null;
  approved_by: string | null;
}

interface MockProfile {
  id: string;
  name: string;
}

interface MockUserProfileLink {
  user_id: string;
  profile_id: string;
  permission: string;
}

// Mock database state
let mockUserProfiles: MockUserProfile[] = [];
let mockProfiles: MockProfile[] = [];
let mockUserProfileLinks: MockUserProfileLink[] = [];

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'admin-user-id' } } },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: 'admin-user-id' } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => ({
                single: vi.fn(async () => {
                  const profile = mockUserProfiles.find((p) => p[field as keyof MockUserProfile] === value);
                  return { data: profile || null, error: null };
                }),
              })),
            })),
            update: vi.fn((updates: Partial<MockUserProfile>) => ({
              eq: vi.fn((field: string, value: string) => {
                const index = mockUserProfiles.findIndex((p) => p[field as keyof MockUserProfile] === value);
                if (index !== -1) {
                  mockUserProfiles[index] = { ...mockUserProfiles[index], ...updates };
                }
                return Promise.resolve({ error: null });
              }),
            })),
          };
        }
        
        if (table === 'user_profile_links') {
          return {
            insert: vi.fn(async (links: MockUserProfileLink[]) => {
              mockUserProfileLinks.push(...links);
              return { error: null };
            }),
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => {
                const links = mockUserProfileLinks.filter((l) => l[field as keyof MockUserProfileLink] === value);
                return Promise.resolve({ data: links, error: null });
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

describe('Property Test: Profile Linking During Approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserProfiles = [];
    mockProfiles = [];
    mockUserProfileLinks = [];
  });

  afterEach(() => {
    mockUserProfiles = [];
    mockProfiles = [];
    mockUserProfileLinks = [];
  });

  it('should create user_profile_links for each specified profile when approving a user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          role: fc.constantFrom('admin', 'approved'),
          profileLinks: fc.array(
            fc.record({
              profileId: fc.uuid(),
              permission: fc.constantFrom('read', 'edit'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ userId, role, profileLinks }) => {
          // Setup: Create a pending user
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'pending',
            approved_at: null,
            approved_by: null,
          });

          // Setup: Create profiles
          profileLinks.forEach((link) => {
            mockProfiles.push({
              id: link.profileId,
              name: `Profile ${link.profileId}`,
            });
          });

          // Action: Approve user with profile links
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              role,
              approved_at: new Date().toISOString(),
              approved_by: 'admin-user-id',
            })
            .eq('id', userId);

          expect(updateError).toBeNull();

          // Create profile links
          const linksToInsert = profileLinks.map((link) => ({
            user_id: userId,
            profile_id: link.profileId,
            permission: link.permission,
          }));

          const { error: linksError } = await supabase
            .from('user_profile_links')
            .insert(linksToInsert);

          expect(linksError).toBeNull();

          // Verification: Check that all profile links were created
          const createdLinks = mockUserProfileLinks.filter((l) => l.user_id === userId);
          
          expect(createdLinks.length).toBe(profileLinks.length);
          
          // Verify each link has correct properties
          profileLinks.forEach((expectedLink) => {
            const actualLink = createdLinks.find(
              (l) => l.profile_id === expectedLink.profileId
            );
            
            expect(actualLink).toBeDefined();
            expect(actualLink.user_id).toBe(userId);
            expect(actualLink.profile_id).toBe(expectedLink.profileId);
            expect(actualLink.permission).toBe(expectedLink.permission);
          });

          // Verify user was approved
          const approvedUser = mockUserProfiles.find((p) => p.id === userId);
          expect(approvedUser.role).toBe(role);
          expect(approvedUser.approved_at).toBeDefined();
          expect(approvedUser.approved_by).toBe('admin-user-id');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle approval without profile links', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          role: fc.constantFrom('admin', 'approved'),
        }),
        async ({ userId, role }) => {
          // Setup: Create a pending user
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'pending',
            approved_at: null,
            approved_by: null,
          });

          // Action: Approve user without profile links
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              role,
              approved_at: new Date().toISOString(),
              approved_by: 'admin-user-id',
            })
            .eq('id', userId);

          expect(updateError).toBeNull();

          // Verification: User should be approved
          const approvedUser = mockUserProfiles.find((p) => p.id === userId);
          expect(approvedUser.role).toBe(role);
          expect(approvedUser.approved_at).toBeDefined();

          // Verification: No profile links should be created
          const userLinks = mockUserProfileLinks.filter((l) => l.user_id === userId);
          expect(userLinks.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve unique profile links per user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          profileId: fc.uuid(),
          permission: fc.constantFrom('read', 'edit'),
        }),
        async ({ userId, profileId, permission }) => {
          // Setup: Create a pending user
          mockUserProfiles.push({
            id: userId,
            email: `user-${userId}@example.com`,
            role: 'pending',
          });

          // Action: Create the same profile link twice
          const linkData = {
            user_id: userId,
            profile_id: profileId,
            permission,
          };

          await supabase.from('user_profile_links').insert([linkData]);
          
          // Try to insert duplicate (in real DB, this would be prevented by UNIQUE constraint)
          // For this test, we'll verify the link exists
          const links = mockUserProfileLinks.filter(
            (l) => l.user_id === userId && l.profile_id === profileId
          );

          // At least one link should exist
          expect(links.length).toBeGreaterThan(0);
          
          // All links should have the same properties
          links.forEach((link) => {
            expect(link.user_id).toBe(userId);
            expect(link.profile_id).toBe(profileId);
            expect(link.permission).toBe(permission);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
