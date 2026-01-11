'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  name: string;
}

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: Profile | null;
  onSuccess: () => void;
}

export function ProfileDialog({
  open,
  onOpenChange,
  profile,
  onSuccess,
}: ProfileDialogProps) {
  const [name, setName] = useState(profile?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const isEditMode = !!profile;

  const validateName = (value: string): boolean => {
    if (!value || value.trim().length === 0) {
      setError('Profile name is required');
      return false;
    }
    if (value.trim().length > 100) {
      setError('Profile name must be less than 100 characters');
      return false;
    }
    setError('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (error) {
      validateName(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateName(name)) {
      return;
    }

    try {
      setLoading(true);

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to manage profiles',
          variant: 'destructive',
        });
        return;
      }

      if (isEditMode && profile) {
        // Update existing profile
        const response = await fetch(`/api/profiles/${profile.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name: name.trim() }),
        });

        if (response.ok) {
          toast({
            title: 'Success',
            description: 'Profile updated successfully',
          });
          onSuccess();
          onOpenChange(false);
          setName('');
        } else {
          const errorData = await response.json();
          toast({
            title: 'Error',
            description: errorData.error || 'Failed to update profile',
            variant: 'destructive',
          });
        }
      } else {
        // Create new profile
        const response = await fetch('/api/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name: name.trim() }),
        });

        if (response.ok) {
          toast({
            title: 'Success',
            description: 'Profile created successfully',
          });
          onSuccess();
          onOpenChange(false);
          setName('');
        } else {
          const errorData = await response.json();
          toast({
            title: 'Error',
            description: errorData.error || 'Failed to create profile',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(profile?.name || '');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Edit Profile' : 'Create New Profile'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? 'Update the profile name below.'
                : 'Enter a name for your new financial profile.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Profile Name</Label>
              <Input
                id="name"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g., Personal, Family, Investment"
                disabled={loading}
                className={error ? 'border-red-500' : ''}
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
