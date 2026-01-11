/**
 * Unit tests for UserNav component
 * Tests user profile dropdown, logout functionality, and admin panel access
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserNav } from '@/components/user-nav';
import * as supabaseModule from '@/lib/supabase';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('UserNav Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render user icon button', async () => {
    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'john.doe@example.com',
    } as unknown as Awaited<ReturnType<typeof supabaseModule.getCurrentUser>>);

    vi.spyOn(supabaseModule, 'getUserProfile').mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'john.doe@example.com',
        role: 'approved',
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    render(<UserNav />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('should display user email and role in dropdown', async () => {
    const user = userEvent.setup();
    
    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as unknown as Awaited<ReturnType<typeof supabaseModule.getCurrentUser>>);

    vi.spyOn(supabaseModule, 'getUserProfile').mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'approved',
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    render(<UserNav />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    // Click to open dropdown
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('approved')).toBeInTheDocument();
    });
  });

  it('should show admin panel option for admin users', async () => {
    const user = userEvent.setup();
    
    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
    } as unknown as Awaited<ReturnType<typeof supabaseModule.getCurrentUser>>);

    vi.spyOn(supabaseModule, 'getUserProfile').mockResolvedValue({
      data: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    render(<UserNav />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    });
  });

  it('should not show admin panel option for non-admin users', async () => {
    const user = userEvent.setup();
    
    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    } as unknown as Awaited<ReturnType<typeof supabaseModule.getCurrentUser>>);

    vi.spyOn(supabaseModule, 'getUserProfile').mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'approved',
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    render(<UserNav />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
    });
  });

  it('should handle sign out', async () => {
    const user = userEvent.setup();
    
    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    } as unknown as Awaited<ReturnType<typeof supabaseModule.getCurrentUser>>);

    vi.spyOn(supabaseModule, 'getUserProfile').mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'approved',
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    const mockSignOut = vi.spyOn(supabaseModule, 'signOut').mockResolvedValue({ error: null });

    render(<UserNav />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Signed out',
        description: 'You have been successfully signed out.',
      });
      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });
  });

  it('should handle sign out error', async () => {
    const user = userEvent.setup();
    
    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    } as unknown as Awaited<ReturnType<typeof supabaseModule.getCurrentUser>>);

    vi.spyOn(supabaseModule, 'getUserProfile').mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'approved',
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    vi.spyOn(supabaseModule, 'signOut').mockRejectedValue(new Error('Sign out failed'));

    render(<UserNav />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    });
  });

  it('should not render when user is not loaded', () => {
    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue(null);

    const { container } = render(<UserNav />);

    expect(container.firstChild).toBeNull();
  });
});
