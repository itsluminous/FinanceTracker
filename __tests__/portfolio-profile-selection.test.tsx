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
  LazyIndividualAssetChart: ({ title }: { title: string }) => <div data-testid="individual-asset-chart">{title}</div>,
}));

const mockGetSession = vi.mocked(await import('@/lib/supabase')).getSession;
const mockGetUserProfile = vi.mocked(await import('@/lib/supabase')).getUserProfile;
const mockGetCache = vi.mocked(await import('@/lib/cache')).getCache;

describe('Portfolio Profile Selection', () => {
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

  it('should show "Getting Started" card when no profiles exist', async () => {
    // Mock API response with no profiles
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ profiles: [] }),
    });

    render(<Portfolio />);

    await waitFor(() => {
      expect(screen.getByText('Personal Finance Tracker')).toBeInTheDocument();
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    // Should not show profile selection
    expect(screen.queryByText('Select Profiles')).not.toBeInTheDocument();
  });

  it('should show portfolio data when profiles are selected', async () => {
    // Mock API responses
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          profiles: [
            { id: 'profile-1', name: 'Personal' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chartData: [
            { date: '2024-01-01', total_assets: 100000, high_medium_risk: 60000, low_risk: 40000 },
          ],
          riskDistribution: [
            { name: 'High/Medium Risk', value: 60000, percentage: 60 },
            { name: 'Low Risk', value: 40000, percentage: 40 },
          ],
          totalAssets: 100000,
          period: '1year',
          profileCount: 1,
        }),
      });

    render(<Portfolio />);

    await waitFor(() => {
      expect(screen.getByText('Total Portfolio Value')).toBeInTheDocument();
      expect(screen.getByText('₹1,00,000')).toBeInTheDocument();
    });
  });

  it('should show profile count when multiple profiles are available', async () => {
    // Mock API responses
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          profiles: [
            { id: 'profile-1', name: 'Personal' },
            { id: 'profile-2', name: 'Business' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chartData: [],
          riskDistribution: [],
          totalAssets: 0,
          period: '1year',
          profileCount: 2,
        }),
      });

    render(<Portfolio />);

    await waitFor(() => {
      expect(screen.getByText('Select Profiles')).toBeInTheDocument();
      expect(screen.getByText('2 of 2 profiles selected')).toBeInTheDocument();
    });
  });
});