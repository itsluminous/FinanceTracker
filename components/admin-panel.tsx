'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AdminPanelSkeleton } from './loading-skeletons';
import { supabase, getCurrentUser } from '@/lib/supabase';

interface PendingUser {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  role: string;
  approved_at?: string;
}

interface Profile {
  id: string;
  name: string;
}

interface UserProfileLink {
  profile_id: string;
  permission: 'read' | 'edit';
  profiles: {
    name: string;
  };
}

export function AdminPanel() {
  const [allUsers, setAllUsers] = useState<PendingUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, string[]>>({});
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [userProfileLinks, setUserProfileLinks] = useState<Record<string, UserProfileLink[]>>({});
  const [editingPermissions, setEditingPermissions] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch ALL users directly from Supabase (RLS handles security)
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, email, name, created_at, role, approved_at')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        toast({
          title: 'Error',
          description: 'Failed to load users',
          variant: 'destructive',
        });
      } else {
        setAllUsers(usersData || []);
        
        // Load profile links for all approved users
        const approvedUserIds = (usersData || [])
          .filter(u => u.role === 'approved')
          .map(u => u.id);
        
        if (approvedUserIds.length > 0) {
          const { data: linksData } = await supabase
            .from('user_profile_links')
            .select(`
              user_id,
              profile_id,
              permission,
              profiles:profile_id (
                name
              )
            `)
            .in('user_id', approvedUserIds);

          if (linksData) {
            const linksByUser: Record<string, UserProfileLink[]> = {};
            linksData.forEach((link: { user_id: string; profile_id: string; permission: 'read' | 'edit'; profiles: { name: string } }) => {
              if (!linksByUser[link.user_id]) {
                linksByUser[link.user_id] = [];
              }
              linksByUser[link.user_id].push({
                profile_id: link.profile_id,
                permission: link.permission,
                profiles: link.profiles,
              });
            });
            setUserProfileLinks(linksByUser);
          }
        }
      }

      // Fetch all profiles for linking
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, created_at')
        .order('name', { ascending: true });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        toast({
          title: 'Error',
          description: 'Failed to load profiles',
          variant: 'destructive',
        });
      } else {
        setProfiles(profilesData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRoleChange = (userId: string, role: string) => {
    setSelectedRoles(prev => ({ ...prev, [userId]: role }));
  };

  const handleProfileToggle = (userId: string, profileId: string) => {
    setSelectedProfiles(prev => {
      const userProfiles = prev[userId] || [];
      const isSelected = userProfiles.includes(profileId);
      
      return {
        ...prev,
        [userId]: isSelected
          ? userProfiles.filter(id => id !== profileId)
          : [...userProfiles, profileId],
      };
    });
  };

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleApprove = async (userId: string) => {
    const role = selectedRoles[userId] || 'approved';
    const profileLinks = selectedProfiles[userId] || [];

    // Determine permission based on role
    let permission: 'read' | 'edit' = 'read';
    if (role === 'admin' || role === 'approved_edit') {
      permission = 'edit';
    } else if (role === 'approved_read') {
      permission = 'read';
    }

    try {
      setProcessingUserId(userId);
      
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        toast({
          title: 'Error',
          description: 'You must be logged in',
          variant: 'destructive',
        });
        return;
      }

      // Map UI role to database role
      const dbRole = role === 'approved_read' || role === 'approved_edit' ? 'approved' : role;

      // Update user role directly via Supabase (RLS handles security)
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          role: dbRole,
          approved_at: new Date().toISOString(),
          approved_by: currentUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user role:', updateError);
        toast({
          title: 'Error',
          description: 'Failed to approve user',
          variant: 'destructive',
        });
        return;
      }

      // Create profile links if any selected
      if (profileLinks.length > 0) {
        const linksToInsert = profileLinks.map(profileId => ({
          user_id: userId,
          profile_id: profileId,
          permission,
        }));

        const { error: linksError } = await supabase
          .from('user_profile_links')
          .insert(linksToInsert);

        if (linksError) {
          console.error('Error creating profile links:', linksError);
          // Don't fail the whole operation, just warn
          toast({
            title: 'Warning',
            description: 'User approved but some profile links failed',
            variant: 'destructive',
          });
        }
      }

      const roleDescription = 
        role === 'admin' ? 'admin role' :
        role === 'approved_edit' ? 'edit access' :
        'read-only access';

      toast({
        title: 'User Approved',
        description: `User has been approved with ${roleDescription}`,
      });
      
      // Reload all data to show updated status
      await loadData();
      
      // Clear selections
      setSelectedRoles(prev => {
        const newRoles = { ...prev };
        delete newRoles[userId];
        return newRoles;
      });
      setSelectedProfiles(prev => {
        const newProfiles = { ...prev };
        delete newProfiles[userId];
        return newProfiles;
      });
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve user',
        variant: 'destructive',
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      setProcessingUserId(userId);
      
      // Delete user profile directly via Supabase (RLS handles security)
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to reject user',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'User Rejected',
        description: 'User has been rejected',
      });
      
      // Reload all data
      await loadData();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject user',
        variant: 'destructive',
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleUpdatePermissions = async (userId: string) => {
    try {
      setProcessingUserId(userId);
      const profileLinks = selectedProfiles[userId] || [];

      // Delete existing links
      await supabase
        .from('user_profile_links')
        .delete()
        .eq('user_id', userId);

      // Create new links if any selected
      if (profileLinks.length > 0) {
        const role = selectedRoles[userId] || 'approved_edit';
        const permission: 'read' | 'edit' = 
          role === 'approved_read' ? 'read' : 'edit';

        const linksToInsert = profileLinks.map(profileId => ({
          user_id: userId,
          profile_id: profileId,
          permission,
        }));

        const { error: linksError } = await supabase
          .from('user_profile_links')
          .insert(linksToInsert);

        if (linksError) {
          console.error('Error updating profile links:', linksError);
          toast({
            title: 'Error',
            description: 'Failed to update permissions',
            variant: 'destructive',
          });
          return;
        }
      }

      toast({
        title: 'Permissions Updated',
        description: 'User permissions have been updated successfully',
      });

      setEditingPermissions(null);
      await loadData();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to update permissions',
        variant: 'destructive',
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  const startEditingPermissions = (userId: string) => {
    setEditingPermissions(userId);
    
    // Load current profile links
    const currentLinks = userProfileLinks[userId] || [];
    setSelectedProfiles(prev => ({
      ...prev,
      [userId]: currentLinks.map(link => link.profile_id),
    }));
    
    // Determine current role based on permissions
    const hasEditPermission = currentLinks.some(link => link.permission === 'edit');
    setSelectedRoles(prev => ({
      ...prev,
      [userId]: hasEditPermission ? 'approved_edit' : 'approved_read',
    }));
  };

  if (loading) {
    return <AdminPanelSkeleton />;
  }

  // Organize users by role
  const pendingUsers = allUsers.filter(u => u.role === 'pending');
  const approvedUsers = allUsers.filter(u => u.role === 'approved');
  const adminUsers = allUsers.filter(u => u.role === 'admin');

  const renderUserCard = (user: PendingUser, isPending: boolean = false) => {
    const isExpanded = expandedUsers[user.id] ?? true;
    const isEditing = editingPermissions === user.id;
    const userLinks = userProfileLinks[user.id] || [];

    return (
      <div
        key={user.id}
        className={`border rounded-lg overflow-hidden transition-smooth ${
          isPending ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900' : ''
        }`}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => toggleUserExpanded(user.id)}
          className="w-full flex items-start justify-between p-3 sm:p-4 bg-muted hover:bg-accent transition-colors sm:cursor-default sm:pointer-events-none"
        >
          <div className="text-left">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 break-all">
              {user.email}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {user.approved_at 
                ? `Approved: ${new Date(user.approved_at).toLocaleDateString()}`
                : `Signed up: ${new Date(user.created_at).toLocaleDateString()}`
              }
            </p>
            {!isPending && userLinks.length > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {userLinks.length} profile{userLinks.length > 1 ? 's' : ''} linked
                {userLinks.some(l => l.permission === 'edit') ? ' (Edit)' : ' (Read-only)'}
              </p>
            )}
          </div>
          <span className="sm:hidden ml-2 flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </span>
        </button>

        {/* Content */}
        <div
          className={`p-3 sm:p-4 space-y-3 sm:space-y-4 transition-all duration-300 ${
            isExpanded ? 'block' : 'hidden sm:block'
          }`}
        >
          {isPending ? (
            // Pending user approval UI
            <>
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Assign Role
                </label>
                <Select
                  value={selectedRoles[user.id] || 'approved_edit'}
                  onValueChange={(value) => handleRoleChange(user.id, value)}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved_read">Approved (Read Only)</SelectItem>
                    <SelectItem value="approved_edit">Approved (Edit Access)</SelectItem>
                    <SelectItem value="admin">Admin (Full Access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {profiles.length > 0 && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    Link to Existing Profiles (Optional)
                  </label>
                  <div className="space-y-2 max-h-32 sm:max-h-40 overflow-y-auto border rounded-md p-2 sm:p-3">
                    {profiles.map(profile => (
                      <label
                        key={profile.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-1.5 sm:p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={(selectedProfiles[user.id] || []).includes(profile.id)}
                          onChange={() => handleProfileToggle(user.id, profile.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                        />
                        <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-all">
                          {profile.name}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                    Select profiles to grant access. User can create new profiles if none selected.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                <Button
                  onClick={() => handleApprove(user.id)}
                  disabled={processingUserId === user.id}
                  className="w-full sm:flex-1 text-sm"
                  size="sm"
                >
                  {processingUserId === user.id ? 'Processing...' : 'Approve'}
                </Button>
                <Button
                  onClick={() => handleReject(user.id)}
                  disabled={processingUserId === user.id}
                  variant="destructive"
                  className="w-full sm:flex-1 text-sm"
                  size="sm"
                >
                  {processingUserId === user.id ? 'Processing...' : 'Reject'}
                </Button>
              </div>
            </>
          ) : (
            // Approved user permissions UI
            <>
              {!isEditing && userLinks.length > 0 && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    Linked Profiles
                  </label>
                  <div className="space-y-1">
                    {userLinks.map(link => (
                      <div key={link.profile_id} className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        • {link.profiles.name} ({link.permission === 'edit' ? 'Edit' : 'Read-only'})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isEditing && (
                <>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                      Permission Level
                    </label>
                    <Select
                      value={selectedRoles[user.id] || 'approved_edit'}
                      onValueChange={(value) => handleRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Select permission" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved_read">Read Only</SelectItem>
                        <SelectItem value="approved_edit">Edit Access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                      Linked Profiles
                    </label>
                    <div className="space-y-2 max-h-32 sm:max-h-40 overflow-y-auto border rounded-md p-2 sm:p-3">
                      {profiles.map(profile => (
                        <label
                          key={profile.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-1.5 sm:p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={(selectedProfiles[user.id] || []).includes(profile.id)}
                            onChange={() => handleProfileToggle(user.id, profile.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                          />
                          <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-all">
                            {profile.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                {!isEditing ? (
                  <>
                    <Button
                      onClick={() => startEditingPermissions(user.id)}
                      variant="outline"
                      className="w-full sm:flex-1 text-sm"
                      size="sm"
                    >
                      Edit Permissions
                    </Button>
                    <Button
                      onClick={() => handleReject(user.id)}
                      disabled={processingUserId === user.id}
                      variant="destructive"
                      className="w-full sm:flex-1 text-sm"
                      size="sm"
                    >
                      Remove User
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => handleUpdatePermissions(user.id)}
                      disabled={processingUserId === user.id}
                      className="w-full sm:flex-1 text-sm"
                      size="sm"
                    >
                      {processingUserId === user.id ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      onClick={() => setEditingPermissions(null)}
                      variant="outline"
                      className="w-full sm:flex-1 text-sm"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">User Management</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Manage user access, approvals, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {/* Pending Users */}
          {pendingUsers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 text-orange-600 dark:text-orange-400">
                Pending Approval ({pendingUsers.length})
              </h3>
              <div className="space-y-3">
                {pendingUsers.map(user => renderUserCard(user, true))}
              </div>
            </div>
          )}

          {/* Admin Users */}
          {adminUsers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3">
                Administrators ({adminUsers.length})
              </h3>
              <div className="space-y-3">
                {adminUsers.map(user => (
                  <div key={user.id} className="border rounded-lg p-3 sm:p-4 bg-muted">
                    <p className="font-semibold text-sm sm:text-base">{user.email}</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Admin • Full Access
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Users */}
          {approvedUsers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3">
                Approved Users ({approvedUsers.length})
              </h3>
              <div className="space-y-3">
                {approvedUsers.map(user => renderUserCard(user, false))}
              </div>
            </div>
          )}

          {allUsers.length === 0 && (
            <div className="text-center py-6 sm:py-8 text-sm sm:text-base text-gray-500">
              No users found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
