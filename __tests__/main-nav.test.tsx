/**
 * Unit tests for MainNav component
 * Tests navigation, responsive menu, and profile selector integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MainNav } from '@/components/main-nav';
import * as supabaseModule from '@/lib/supabase';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/',
}));

// Mock child components
vi.mock('@/components/user-nav', () => ({
  UserNav: () => <div>UserNav</div>,
}));

vi.mock('@/components/profile-selector', () => ({
  ProfileSelector: ({ onProfileSelect, onAddProfile }: { onProfileSelect: (id: string) => void; onAddProfile: () => void }) => (
    <div>
      <button onClick={() => onProfileSelect('profile-1')}>Select Profile</button>
      <button onClick={onAddProfile}>Add Profile</button>
    </div>
  ),
}));

vi.mock('@/components/profile-dialog', () => ({
  ProfileDialog: ({ open }: { open: boolean; onSuccess: () => void }) => (
    open ? <div>Profile Dialog</div> : null
  ),
}));

vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <div>Theme Toggle</div>,
}));

describe('MainNav Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render navigation with logo', async () => {
    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    vi.spyOn(supabaseModule, 'getUserProfile').mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'approved',
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    render(<MainNav />);

    await waitFor(() => {
      expect(screen.getByText('Finance Tracker')).toBeInTheDocument();
    });
  });

  it('should show Profiles button for approved users', async () => {
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

    render(<MainNav />);

    await waitFor(() => {
      expect(screen.getByText('Profiles')).toBeInTheDocument();
    });
  });

  it('should show Profiles button for admin users', async () => {
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

    render(<MainNav />);

    await waitFor(() => {
      expect(screen.getByText('Profiles')).toBeInTheDocument();
    });
  });

  it('should not show Profiles button for pending users', async () => {
    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as unknown as Awaited<ReturnType<typeof supabaseModule.getCurrentUser>>);

    vi.spyOn(supabaseModule, 'getUserProfile').mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'pending',
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    render(<MainNav />);

    await waitFor(() => {
      expect(screen.queryByText('Profiles')).not.toBeInTheDocument();
    });
  });

  it('should render profile selector when showProfileSelector is true', async () => {
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

    render(<MainNav showProfileSelector />);

    await waitFor(() => {
      // Should have two instances: one for desktop, one for mobile
      expect(screen.getAllByText('Select Profile')).toHaveLength(2);
    });
  });

  it('should call onProfileSelect when profile is selected', async () => {
    const user = userEvent.setup();
    const mockOnProfileSelect = vi.fn();

    vi.spyOn(supabaseModule, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    vi.spyOn(supabaseModule, 'getUserProfile').mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'approved',
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseModule.getUserProfile>>);

    render(<MainNav showProfileSelector onProfileSelect={mockOnProfileSelect} />);

    await waitFor(() => {
      expect(screen.getAllByText('Select Profile')).toHaveLength(2);
    });

    // Click the first instance (desktop or mobile)
    await user.click(screen.getAllByText('Select Profile')[0]);

    expect(mockOnProfileSelect).toHaveBeenCalledWith('profile-1');
  });

  it('should toggle mobile menu', async () => {
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

    render(<MainNav />);

    await waitFor(() => {
      expect(screen.getByText('Finance Tracker')).toBeInTheDocument();
    });

    // Mobile menu should not be visible initially
    const mobileProfiles = screen.queryAllByText('Profiles');
    expect(mobileProfiles.length).toBe(1); // Only desktop version
  });
});
