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
}

interface Profile {
  id: string;
  name: string;
}

export function AdminPanel() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, string[]>>({});
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch pending users directly from Supabase (RLS handles security)
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, email, name, created_at')
        .eq('role', 'pending')
        .order('created_at', { ascending: true });

      if (usersError) {
        console.error('Error fetching pending users:', usersError);
        toast({
          title: 'Error',
          description: 'Failed to load pending users',
          variant: 'destructive',
        });
      } else {
        setPendingUsers(usersData || []);
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
    if (role === 'admin' || role === 'approved') {
      permission = 'edit';
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

      // Update user role directly via Supabase (RLS handles security)
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          role,
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

      toast({
        title: 'User Approved',
        description: `User has been approved with ${role} role`,
      });
      
      // Remove user from pending list
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      
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
      
      // Remove user from pending list
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
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

  if (loading) {
    return <AdminPanelSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Pending User Approvals</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Review and approve or reject new user registrations
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {pendingUsers.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-sm sm:text-base text-gray-500">
              No pending user approvals
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {pendingUsers.map(user => {
                const isExpanded = expandedUsers[user.id] ?? true;
                
                return (
                  <div
                    key={user.id}
                    className="border rounded-lg overflow-hidden transition-smooth"
                  >
                    {/* Mobile: Collapsible header, Desktop: Always visible */}
                    <button
                      type="button"
                      onClick={() => toggleUserExpanded(user.id)}
                      className="w-full flex items-start justify-between p-3 sm:p-4 bg-muted hover:bg-accent transition-colors sm:cursor-default sm:pointer-events-none"
                    >
                      <div className="text-left">
                        <h3 className="font-semibold text-sm sm:text-base text-gray-900 break-all">
                          {user.email}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                          Signed up: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="sm:hidden ml-2 flex-shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </span>
                    </button>

                    {/* Collapsible content */}
                    <div
                      className={`p-3 sm:p-4 space-y-3 sm:space-y-4 transition-all duration-300 ${
                        isExpanded ? 'block' : 'hidden sm:block'
                      }`}
                    >
                      <div>
                        <label className="text-xs sm:text-sm font-medium text-gray-700 block mb-2">
                          Assign Role
                        </label>
                        <Select
                          value={selectedRoles[user.id] || 'approved'}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-full text-sm">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="approved">Approved (Edit Access)</SelectItem>
                            <SelectItem value="admin">Admin (Full Access)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {profiles.length > 0 && (
                        <div>
                          <label className="text-xs sm:text-sm font-medium text-gray-700 block mb-2">
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
                                <span className="text-xs sm:text-sm text-gray-700 break-all">
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

                      {/* Action buttons */}
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
