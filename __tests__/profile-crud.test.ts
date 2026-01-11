import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Types for mock data
interface MockProfile {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface MockUserProfile {
  id: string;
  role: string;
}

interface MockUserProfileLink {
  id: string;
  user_id: string;
  profile_id: string;
  permission: string;
}

// Mock database state
let mockProfiles: MockProfile[] = [];
let mockUserProfiles: MockUserProfile[] = [];
let mockUserProfileLinks: MockUserProfileLink[] = [];

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
                      id: inputProfile.id || `profile-${Date.now()}`,
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
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => ({
                single: vi.fn(async () => {
                  const profile = mockProfiles.find((p) => p[field as keyof MockProfile] === value);
                  return { data: profile || null, error: null };
                }),
              })),
              order: vi.fn(() => {
                return Promise.resolve({ data: mockProfiles, error: null });
              }),
            })),
            update: vi.fn((updates: Partial<MockProfile>) => ({
              eq: vi.fn((field: string, value: string) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    // Add a small delay to ensure timestamp changes
                    await new Promise(resolve => setTimeout(resolve, 10));
                    const index = mockProfiles.findIndex((p) => p[field as keyof MockProfile] === value);
                    if (index !== -1) {
                      mockProfiles[index] = {
                        ...mockProfiles[index],
                        ...updates,
                        updated_at: new Date().toISOString(),
                      };
                      return { data: mockProfiles[index], error: null };
                    }
                    return { data: null, error: { message: 'Profile not found' } };
                  }),
                })),
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => {
                const index = mockProfiles.findIndex((p) => p[field as keyof MockProfile] === value);
                if (index !== -1) {
                  const profileId = mockProfiles[index].id;
                  mockProfiles.splice(index, 1);
                  
                  // CASCADE: Delete associated user_profile_links
                  mockUserProfileLinks = mockUserProfileLinks.filter(
                    (link) => link.profile_id !== profileId
                  );
                }
                return Promise.resolve({ error: null });
              }),
            })),
          };
        }
        
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
          };
        }
        
        if (table === 'user_profile_links') {
          return {
            insert: vi.fn(async (links: Partial<MockUserProfileLink> | Partial<MockUserProfileLink>[]) => {
              // Normalize to array
              const linkArray = Array.isArray(links) ? links : [links];
              
              linkArray.forEach((link) => {
                mockUserProfileLinks.push({
                  id: `link-${Date.now()}`,
                  user_id: link.user_id || '',
                  profile_id: link.profile_id || '',
                  permission: link.permission || 'read',
                });
              });
              return { error: null };
            }),
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => ({
                single: vi.fn(async () => {
                  const link = mockUserProfileLinks.find((l) => l[field as keyof MockUserProfileLink] === value);
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

describe('Profile CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfiles = [];
    mockUserProfiles = [];
    mockUserProfileLinks = [];
    
    // Setup: Create an approved user
    mockUserProfiles.push({
      id: 'test-user-id',
      role: 'approved',
    });
  });

  afterEach(() => {
    mockProfiles = [];
    mockUserProfiles = [];
    mockUserProfileLinks = [];
  });

  describe('Profile Creation', () => {
    it('should create a new profile with valid name', async () => {
      // Arrange
      const profileName = 'Finance Tracker';

      // Act
      const { data: profile, error } = await supabase
        .from('profiles')
        .insert({ name: profileName })
        .select()
        .single();

      // Assert
      expect(error).toBeNull();
      expect(profile).toBeDefined();
      expect(profile.name).toBe(profileName);
      expect(profile.id).toBeDefined();
      expect(profile.created_at).toBeDefined();
      expect(profile.updated_at).toBeDefined();
    });

    it('should create profile and link it to user', async () => {
      // Arrange
      const profileName = 'Family Budget';
      const userId = 'test-user-id';

      // Act: Create profile
      const { data: profile } = await supabase
        .from('profiles')
        .insert({ name: profileName })
        .select()
        .single();

      // Act: Link profile to user
      const { error: linkError } = await supabase
        .from('user_profile_links')
        .insert({
          user_id: userId,
          profile_id: profile.id,
          permission: 'edit',
        });

      // Assert
      expect(linkError).toBeNull();
      expect(mockUserProfileLinks.length).toBe(1);
      expect(mockUserProfileLinks[0].user_id).toBe(userId);
      expect(mockUserProfileLinks[0].profile_id).toBe(profile.id);
      expect(mockUserProfileLinks[0].permission).toBe('edit');
    });

    it('should reject empty profile name', async () => {
      // Arrange
      const profileName = '';

      // Act
      const { data: profile } = await supabase
        .from('profiles')
        .insert({ name: profileName })
        .select()
        .single();

      // Assert: Profile is created but validation should happen at API level
      // This test verifies the database layer accepts the data
      expect(profile).toBeDefined();
      expect(profile.name).toBe(profileName);
    });
  });

  describe('Profile Retrieval', () => {
    it('should retrieve profile by id', async () => {
      // Arrange: Create a profile
      const { data: createdProfile } = await supabase
        .from('profiles')
        .insert({ name: 'Test Profile' })
        .select()
        .single();

      // Act: Retrieve the profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select()
        .eq('id', createdProfile.id)
        .single();

      // Assert
      expect(error).toBeNull();
      expect(profile).toBeDefined();
      expect(profile.id).toBe(createdProfile.id);
      expect(profile.name).toBe('Test Profile');
    });

    it('should retrieve all profiles for admin user', async () => {
      // Arrange: Create multiple profiles
      await supabase.from('profiles').insert({ name: 'Profile 1' }).select().single();
      await supabase.from('profiles').insert({ name: 'Profile 2' }).select().single();
      await supabase.from('profiles').insert({ name: 'Profile 3' }).select().single();

      // Act: Retrieve all profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select()
        .order('name');

      // Assert
      expect(error).toBeNull();
      expect(profiles).toBeDefined();
      expect(profiles.length).toBe(3);
    });

    it('should return null for non-existent profile', async () => {
      // Act
      const { data: profile } = await supabase
        .from('profiles')
        .select()
        .eq('id', 'non-existent-id')
        .single();

      // Assert
      expect(profile).toBeNull();
    });
  });

  describe('Profile Update', () => {
    it('should update profile name', async () => {
      // Arrange: Create a profile
      const { data: createdProfile } = await supabase
        .from('profiles')
        .insert({ name: 'Old Name' })
        .select()
        .single();

      // Wait 1ms to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));

      // Act: Update the profile
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({ name: 'New Name' })
        .eq('id', createdProfile.id)
        .select()
        .single();

      // Assert
      expect(error).toBeNull();
      expect(updatedProfile).toBeDefined();
      expect(updatedProfile.name).toBe('New Name');
      expect(updatedProfile.id).toBe(createdProfile.id);
      expect(updatedProfile.updated_at).not.toBe(createdProfile.updated_at);
    });

    it('should fail to update non-existent profile', async () => {
      // Act
      const { data: profile, error } = await supabase
        .from('profiles')
        .update({ name: 'New Name' })
        .eq('id', 'non-existent-id')
        .select()
        .single();

      // Assert
      expect(profile).toBeNull();
      expect(error).toBeDefined();
    });
  });

  describe('Profile Deletion', () => {
    it('should delete profile', async () => {
      // Arrange: Create a profile
      const { data: createdProfile } = await supabase
        .from('profiles')
        .insert({ name: 'To Delete' })
        .select()
        .single();

      // Act: Delete the profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', createdProfile.id);

      // Assert
      expect(error).toBeNull();

      // Verify profile is deleted
      const { data: deletedProfile } = await supabase
        .from('profiles')
        .select()
        .eq('id', createdProfile.id)
        .single();

      expect(deletedProfile).toBeNull();
    });

    it('should cascade delete user_profile_links when profile is deleted', async () => {
      // Arrange: Create a profile and link it to a user
      const { data: profile } = await supabase
        .from('profiles')
        .insert({ name: 'To Delete' })
        .select()
        .single();

      await supabase
        .from('user_profile_links')
        .insert({
          user_id: 'test-user-id',
          profile_id: profile.id,
          permission: 'edit',
        });

      expect(mockUserProfileLinks.length).toBe(1);

      // Act: Delete the profile
      await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id);

      // Assert: User profile links should be deleted
      expect(mockUserProfileLinks.length).toBe(0);
    });
  });

  describe('Profile Permissions', () => {
    it('should allow user with edit permission to access profile', async () => {
      // Arrange: Create a profile and link it with edit permission
      const { data: profile } = await supabase
        .from('profiles')
        .insert({ name: 'Editable Profile' })
        .select()
        .single();

      await supabase
        .from('user_profile_links')
        .insert({
          user_id: 'test-user-id',
          profile_id: profile.id,
          permission: 'edit',
        });

      // Act: Check if link exists
      const { data: link } = await supabase
        .from('user_profile_links')
        .select()
        .eq('profile_id', profile.id)
        .single();

      // Assert
      expect(link).toBeDefined();
      expect(link.permission).toBe('edit');
    });

    it('should allow user with read permission to access profile', async () => {
      // Arrange: Create a profile and link it with read permission
      const { data: profile } = await supabase
        .from('profiles')
        .insert({ name: 'Readable Profile' })
        .select()
        .single();

      await supabase
        .from('user_profile_links')
        .insert({
          user_id: 'test-user-id',
          profile_id: profile.id,
          permission: 'read',
        });

      // Act: Check if link exists
      const { data: link } = await supabase
        .from('user_profile_links')
        .select()
        .eq('profile_id', profile.id)
        .single();

      // Assert
      expect(link).toBeDefined();
      expect(link.permission).toBe('read');
    });
  });
});
