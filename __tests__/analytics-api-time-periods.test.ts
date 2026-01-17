import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/analytics/combined/route';

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [],
        error: null,
      })),
      in: vi.fn(() => ({
        order: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('@/lib/analytics', () => ({
  filterCombinedPortfolioByPeriod: vi.fn(() => new Map()),
  aggregateCombinedPortfolio: vi.fn(() => ({
    chartData: [],
    riskDistribution: [],
    totalAssets: 0,
  })),
}));

describe('Analytics API Time Period Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Mock profile links
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: [{ profile_id: 'profile-1' }],
          error: null,
        })),
      })),
    });

    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validTimePeriods = ['30days', '3months', '1year', '3years', '5years', '10years'];
  const invalidTimePeriods = ['1day', '1week', '2years', '20years', 'invalid'];

  describe('Valid time periods', () => {
    validTimePeriods.forEach(period => {
      it(`should accept ${period} as a valid time period`, async () => {
        const request = new NextRequest(`http://localhost/api/analytics/combined?period=${period}`, {
          headers: { authorization: 'Bearer test-token' },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).not.toBe(400);
        expect(data.error).not.toBe('Invalid time period');
      });
    });
  });

  describe('Invalid time periods', () => {
    invalidTimePeriods.forEach(period => {
      it(`should reject ${period} as an invalid time period`, async () => {
        const request = new NextRequest(`http://localhost/api/analytics/combined?period=${period}`, {
          headers: { authorization: 'Bearer test-token' },
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid time period');
      });
    });
  });

  it('should default to 1year when no period is specified', async () => {
    const request = new NextRequest('http://localhost/api/analytics/combined', {
      headers: { authorization: 'Bearer test-token' },
    });

    const response = await GET(request);
    
    expect(response.status).not.toBe(400);
    // The default period should be handled without validation errors
  });

  it('should handle empty period parameter', async () => {
    const request = new NextRequest('http://localhost/api/analytics/combined?period=', {
      headers: { authorization: 'Bearer test-token' },
    });

    const response = await GET(request);
    
    expect(response.status).not.toBe(400);
    // Empty period should default to 1year
  });

  it('should be case sensitive for time periods', async () => {
    const request = new NextRequest('http://localhost/api/analytics/combined?period=1YEAR', {
      headers: { authorization: 'Bearer test-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid time period');
  });

  it('should handle multiple query parameters correctly', async () => {
    const request = new NextRequest('http://localhost/api/analytics/combined?period=3years&profileIds=profile-1,profile-2', {
      headers: { authorization: 'Bearer test-token' },
    });

    const response = await GET(request);
    
    expect(response.status).not.toBe(400);
    // Should process both period and profileIds without validation errors
  });

  describe('Authorization requirements', () => {
    it('should require authorization header', async () => {
      const request = new NextRequest('http://localhost/api/analytics/combined?period=1year');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Missing authorization header');
    });

    it('should validate user authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Invalid token'),
      });

      const request = new NextRequest('http://localhost/api/analytics/combined?period=1year', {
        headers: { authorization: 'Bearer invalid-token' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Profile handling', () => {
    it('should handle users with no profile links', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({
            data: [],
            error: null,
          })),
        })),
      });

      const request = new NextRequest('http://localhost/api/analytics/combined?period=1year', {
        headers: { authorization: 'Bearer test-token' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('No profiles linked to your account');
      expect(data.chartData).toEqual([]);
      expect(data.totalAssets).toBe(0);
    });

    it('should filter profileIds to only include linked profiles', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({
              data: [{ profile_id: 'profile-1' }, { profile_id: 'profile-2' }],
              error: null,
            })),
          })),
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: [],
                error: null,
              })),
            })),
          })),
        });

      const request = new NextRequest('http://localhost/api/analytics/combined?period=1year&profileIds=profile-1,profile-3,profile-2', {
        headers: { authorization: 'Bearer test-token' },
      });

      const response = await GET(request);
      
      expect(response.status).toBe(200);
      // Should only process profile-1 and profile-2, filtering out profile-3
    });
  });
});