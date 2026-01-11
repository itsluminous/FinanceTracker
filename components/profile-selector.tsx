'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { ProfileSelectorSkeleton } from './loading-skeletons';

interface Profile {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ProfileSelectorProps {
  onProfileSelect: (profileId: string) => void;
  onAddProfile: () => void;
  selectedProfileId?: string;
  compact?: boolean;
}

export function ProfileSelector({
  onProfileSelect,
  onAddProfile,
  selectedProfileId,
  compact = false,
}: ProfileSelectorProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to view profiles',
          variant: 'destructive',
        });
        return;
      }

      // Fetch profiles
      const response = await fetch('/api/profiles', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
        
        // Auto-select first profile if none selected
        if (!selectedProfileId && data.profiles && data.profiles.length > 0) {
          onProfileSelect(data.profiles[0].id);
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to load profiles',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profiles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (profileId: string) => {
    onProfileSelect(profileId);
  };

  if (loading) {
    return <ProfileSelectorSkeleton />;
  }

  // Empty state - no profiles linked
  if (profiles.length === 0) {
    if (compact) {
      return (
        <div className="text-sm text-gray-500">
          No profiles available
        </div>
      );
    }
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>No Profiles Found</CardTitle>
          <CardDescription>
            You don&apos;t have any profiles yet. Create your first profile to start tracking your finances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onAddProfile} className="w-full">
            Add Your First Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Compact mode - just the select dropdown
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Select
          value={selectedProfileId}
          onValueChange={handleProfileChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a profile" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map(profile => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onAddProfile} variant="outline" size="sm">
          Add
        </Button>
      </div>
    );
  }

  // Profile selection interface
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Select Profile
          </label>
          <Select
            value={selectedProfileId}
            onValueChange={handleProfileChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(profile => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="pt-7">
          <Button onClick={onAddProfile} variant="outline">
            Add New Profile
          </Button>
        </div>
      </div>

      {/* Card grid view for larger screens */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {profiles.map(profile => (
          <Card
            key={profile.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedProfileId === profile.id
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : ''
            }`}
            onClick={() => handleProfileChange(profile.id)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{profile.name}</CardTitle>
              <CardDescription className="text-xs">
                Created: {new Date(profile.created_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
