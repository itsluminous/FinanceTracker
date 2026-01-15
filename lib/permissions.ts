import { supabase } from './supabase';

interface UserProfileData {
  role: 'admin' | 'approved' | 'pending' | 'rejected';
}

interface UserProfileLinkData {
  permission: 'read' | 'edit';
}

interface ProfileData {
  id: string;
  name: string;
}

/**
 * Check if a user has edit permission for a specific profile
 */
export async function hasEditPermission(userId: string, profileId: string): Promise<boolean> {
  try {
    // Check if user is admin (admins have edit permission everywhere)
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if ((userProfile as UserProfileData | null)?.role === 'admin') {
      return true;
    }

    // Check user_profile_links for edit permission
    const { data: link } = await supabase
      .from('user_profile_links')
      .select('permission')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .single();

    return (link as UserProfileLinkData | null)?.permission === 'edit';
  } catch (error) {
    console.error('Error checking edit permission:', error);
    return false;
  }
}

/**
 * Check if a user has any permission (read or edit) for a specific profile
 */
export async function hasAnyPermission(userId: string, profileId: string): Promise<boolean> {
  try {
    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if ((userProfile as UserProfileData | null)?.role === 'admin') {
      return true;
    }

    // Check user_profile_links for any permission
    const { data: link } = await supabase
      .from('user_profile_links')
      .select('permission')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .single();

    return !!(link as UserProfileLinkData | null);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Get all profiles a user has access to with their permissions
 */
export async function getUserProfilesWithPermissions(userId: string): Promise<Array<{
  id: string;
  name: string;
  permission: 'read' | 'edit';
}>> {
  try {
    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if ((userProfile as UserProfileData | null)?.role === 'admin') {
      // Admins get all profiles with edit permission
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');

      return ((profiles as ProfileData[] | null) || []).map(p => ({ ...p, permission: 'edit' as const }));
    }

    // Get profiles with permissions from user_profile_links
    const { data: links } = await supabase
      .from('user_profile_links')
      .select(`
        permission,
        profiles:profile_id (
          id,
          name
        )
      `)
      .eq('user_id', userId);

    if (!links) return [];

    interface LinkWithProfile {
      permission: 'read' | 'edit';
      profiles: { id: string; name: string } | null;
    }

    return (links as LinkWithProfile[])
      .filter(link => link.profiles)
      .map(link => ({
        id: (link.profiles as { id: string; name: string }).id,
        name: (link.profiles as { id: string; name: string }).name,
        permission: link.permission,
      }));
  } catch (error) {
    console.error('Error getting user profiles with permissions:', error);
    return [];
  }
}
