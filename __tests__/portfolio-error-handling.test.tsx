import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Portfolio } from '@/components/portfolio';

// Mock the dependencies
vi.mock('@/lib/supabase', () => ({
  getSession: vi.fn(),
  getUserProfile: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/components/lazy-charts', () => ({
  LazyRiskDistributionChart: ({ title }: { title: string }) => <div data-testid="risk-chart">{title}</div>,
  LazyAssetTrendChart: ({ title }: { title: string }) => <div data-testid="trend-chart">{title}</div>,
}));

const mockGetSession = vi.mocked(await import('@/lib/supabase')).getSession;
const mockGetUserProfile = vi.mocked(await import('@/lib/supabase')).getUserProfile;
const mockGetCache = vi.mocked(await import('@/lib/cache')).getCache;

describe('Portfolio Error Handling', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock successful session
    mockGetSession.mockResolvedValue({
      session: {
        user: { 
          id: 'user-123',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2024-01-01T00:00:00Z'
        },
        access_token: 'token-123',
      },
    });

    // Mock user profile
    mockGetUserProfile.mockResolvedValue({
      data: {
        id: 'profile-123',
        email: 'test@example.com',
        role: 'approved',
        approved_at: '2024-01-01T00:00:00Z',
        approved_by: 'admin-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    });

    // Mock cache as empty
    mockGetCache.mockReturnValue(null);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show specific error message for invalid time period', async () => {
    // Mock profiles API success
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          profiles: [{ id: 'profile-1', name: 'Personal' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: 'Invalid time period',
        }),
      });

    render(<Portfolio />);

    // Wait for component to load and trigger error
    await waitFor(() => {
      expect(screen.getByText('The selected time period (1year) is not supported. Please try a shorter period.')).toBeInTheDocument();
    });
  });

  it('should show generic error message for other API errors', async () => {
    // Mock profiles API success
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          profiles: [{ id: 'profile-1', name: 'Personal' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: 'Internal server error',
        }),
      });

    render(<Portfolio />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load portfolio data. Please try again.')).toBeInTheDocument();
    });
  });

  it('should handle session errors gracefully', async () => {
    // Mock session failure
    mockGetSession.mockResolvedValue({
      session: null,
      error: null,
    });

    render(<Portfolio />);

    await waitFor(() => {
      // When there's no session, the component shows the "Getting Started" card
      expect(screen.getByText('Personal Finance Tracker')).toBeInTheDocument();
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });
  });
});