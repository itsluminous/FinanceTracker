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
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch pending users
      const usersResponse = await fetch('/api/admin/users/pending');
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setPendingUsers(usersData.users || []);
      }

      // Fetch all profiles for linking
      const profilesResponse = await fetch('/api/admin/profiles');
      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json();
        setProfiles(profilesData.profiles || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending users and profiles',
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
      
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          profileLinks: profileLinks.map(profileId => ({
            profileId,
            permission,
          })),
        }),
      });

      if (response.ok) {
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
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to approve user',
          variant: 'destructive',
        });
      }
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
      
      const response = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'User Rejected',
          description: 'User has been rejected',
        });
        
        // Remove user from pending list
        setPendingUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to reject user',
          variant: 'destructive',
        });
      }
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
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pending User Approvals</CardTitle>
          <CardDescription>
            Review and approve or reject new user registrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending user approvals
            </div>
          ) : (
            <div className="space-y-6">
              {pendingUsers.map(user => (
                <div
                  key={user.id}
                  className="border rounded-lg p-4 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.email}</h3>
                      <p className="text-sm text-gray-500">
                        Signed up: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Assign Role
                      </label>
                      <Select
                        value={selectedRoles[user.id] || 'approved'}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className="w-full">
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
                        <label className="text-sm font-medium text-gray-700 block mb-2">
                          Link to Existing Profiles (Optional)
                        </label>
                        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                          {profiles.map(profile => (
                            <label
                              key={profile.id}
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={(selectedProfiles[user.id] || []).includes(profile.id)}
                                onChange={() => handleProfileToggle(user.id, profile.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{profile.name}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Select profiles to grant access. User can create new profiles if none selected.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => handleApprove(user.id)}
                      disabled={processingUserId === user.id}
                      className="flex-1"
                    >
                      {processingUserId === user.id ? 'Processing...' : 'Approve'}
                    </Button>
                    <Button
                      onClick={() => handleReject(user.id)}
                      disabled={processingUserId === user.id}
                      variant="destructive"
                      className="flex-1"
                    >
                      {processingUserId === user.id ? 'Processing...' : 'Reject'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
