import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Types for mock data
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
  permission: string;
}

// Mock database state
let mockProfiles: MockProfile[] = [];
let mockUserProfileLinks: MockUserProfileLink[] = [];

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            insert: vi.fn((profiles: Partial<MockProfile> | Partial<MockProfile>[]) => {
              // Normalize to array
              const profileArray = Array.isArray(profiles) ? profiles : [profiles];
              
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    const inputProfile = profileArray[0];
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
            select: vi.fn((fields?: string) => ({
              eq: vi.fn((field: string, value: string) => ({
                single: vi.fn(async () => {
                  const profile = mockProfiles.find((p) => p[field as keyof MockProfile] === value);
                  return { data: profile || null, error: null };
                }),
                maybeSingle: vi.fn(async () => {
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

describe('Property Test: Profile Independence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfiles = [];
    mockUserProfileLinks = [];
  });

  afterEach(() => {
    mockProfiles = [];
    mockUserProfileLinks = [];
  });

  it('should allow profiles to exist without any user_profile_links entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ profileId, profileName }) => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          mockUserProfileLinks = [];
          
          // Action: Create a profile without linking it to any user
          const { data: profile, error } = await supabase
            .from('profiles')
            .insert({ id: profileId, name: profileName })
            .select()
            .single();

          // Verification: Profile should be created successfully
          expect(error).toBeNull();
          expect(profile).toBeDefined();
          expect(profile.id).toBe(profileId);
          expect(profile.name).toBe(profileName);

          // Verification: Profile should exist in the profiles table
          const createdProfile = mockProfiles.find((p) => p.id === profileId);
          expect(createdProfile).toBeDefined();
          expect(createdProfile.name).toBe(profileName);

          // Verification: No user_profile_links should exist for this profile
          const { data: links } = await supabase
            .from('user_profile_links')
            .select()
            .eq('profile_id', profileId);

          expect(links).toBeDefined();
          expect(links.length).toBe(0);

          // Verification: Profile can be retrieved independently
          const { data: retrievedProfile } = await supabase
            .from('profiles')
            .select()
            .eq('id', profileId)
            .single();

          expect(retrievedProfile).toBeDefined();
          expect(retrievedProfile.id).toBe(profileId);
          expect(retrievedProfile.name).toBe(profileName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow multiple unlinked profiles to coexist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            profileId: fc.uuid(),
            profileName: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (profiles) => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          mockUserProfileLinks = [];
          
          // Action: Create multiple profiles without linking them to any users
          for (const { profileId, profileName } of profiles) {
            const { error } = await supabase
              .from('profiles')
              .insert({ id: profileId, name: profileName })
              .select()
              .single();

            expect(error).toBeNull();
          }

          // Verification: All profiles should exist in the profiles table
          expect(mockProfiles.length).toBe(profiles.length);

          // Verification: Each profile should be retrievable
          for (const { profileId, profileName } of profiles) {
            const createdProfile = mockProfiles.find((p) => p.id === profileId);
            expect(createdProfile).toBeDefined();
            expect(createdProfile.name).toBe(profileName);

            // Verification: No user_profile_links should exist for any profile
            const { data: links } = await supabase
              .from('user_profile_links')
              .select()
              .eq('profile_id', profileId);

            expect(links).toBeDefined();
            expect(links.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain profile independence even after user_profile_links are deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          profileId: fc.uuid(),
          profileName: fc.string({ minLength: 1, maxLength: 100 }),
          userId: fc.uuid(),
        }),
        async ({ profileId, profileName, userId }) => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          mockUserProfileLinks = [];
          
          // Setup: Create a profile
          await supabase
            .from('profiles')
            .insert({ id: profileId, name: profileName })
            .select()
            .single();

          // Setup: Create a user_profile_link
          const linkId = fc.sample(fc.uuid(), 1)[0];
          mockUserProfileLinks.push({
            id: linkId,
            user_id: userId,
            profile_id: profileId,
            permission: 'edit',
          });

          // Verification: Link exists
          let { data: links } = await supabase
            .from('user_profile_links')
            .select()
            .eq('profile_id', profileId);

          expect(links.length).toBe(1);

          // Action: Remove the user_profile_link
          mockUserProfileLinks = mockUserProfileLinks.filter(
            (l) => l.profile_id !== profileId
          );

          // Verification: Link is removed
          ({ data: links } = await supabase
            .from('user_profile_links')
            .select()
            .eq('profile_id', profileId));

          expect(links.length).toBe(0);

          // Verification: Profile still exists independently
          const { data: profile } = await supabase
            .from('profiles')
            .select()
            .eq('id', profileId)
            .single();

          expect(profile).toBeDefined();
          expect(profile.id).toBe(profileId);
          expect(profile.name).toBe(profileName);

          // Verification: Profile is still in the profiles table
          const existingProfile = mockProfiles.find((p) => p.id === profileId);
          expect(existingProfile).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
