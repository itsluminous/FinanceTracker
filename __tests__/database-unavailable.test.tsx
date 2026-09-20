import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Home from '@/app/page';

// Mock supabase helpers
vi.mock('@/lib/supabase', () => ({
  getCurrentUser: vi.fn(),
  checkSupabaseConnection: vi.fn(),
  // Pass-through: timeout behavior itself is exercised in real code paths
  withTimeout: vi.fn(<T,>(promise: Promise<T>) => promise),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Keep the page render light — these components have their own tests
vi.mock('@/components/portfolio', () => ({
  Portfolio: () => <div data-testid="portfolio" />,
}));
vi.mock('@/components/main-nav', () => ({
  MainNav: () => <nav data-testid="main-nav" />,
}));

const mockGetCurrentUser = vi.mocked(await import('@/lib/supabase')).getCurrentUser;
const mockCheckSupabaseConnection = vi.mocked(
  await import('@/lib/supabase')
).checkSupabaseConnection;

describe('Home page — database unavailable handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the unavailable note when auth check fails and database is unreachable', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Request timed out after 10000ms'));
    mockCheckSupabaseConnection.mockResolvedValue(false);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Database is unavailable')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/The database may be paused due to inactivity/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the unavailable note when there is no user and database is unreachable', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockCheckSupabaseConnection.mockResolvedValue(false);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Database is unavailable')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to login when there is no user but database is reachable', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockCheckSupabaseConnection.mockResolvedValue(true);

    render(<Home />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });
    expect(screen.queryByText('Database is unavailable')).not.toBeInTheDocument();
  });

  it('renders the portfolio when a user is logged in', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00Z',
    } as Awaited<ReturnType<typeof mockGetCurrentUser>>);
    mockCheckSupabaseConnection.mockResolvedValue(true);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByTestId('portfolio')).toBeInTheDocument();
    });
    expect(screen.queryByText('Database is unavailable')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('reloads the page when Try again is clicked', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockCheckSupabaseConnection.mockResolvedValue(false);

    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });

    render(<Home />);

    const button = await screen.findByRole('button', { name: /try again/i });
    fireEvent.click(button);

    expect(reloadSpy).toHaveBeenCalled();
  });
});
