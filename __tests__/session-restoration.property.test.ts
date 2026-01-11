import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => {
  interface MockSession {
    user: { id: string; email: string };
    access_token: string;
    refresh_token?: string;
  }
  
  let mockSession: MockSession | null = null;
  
  return {
    createClient: vi.fn(() => ({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: mockSession },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: mockSession?.user || null },
          error: null,
        })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
          if (email && password) {
            mockSession = {
              user: { id: 'test-user-id', email },
              access_token: 'test-token',
              refresh_token: 'test-refresh-token',
            };
            return { data: { user: mockSession.user, session: mockSession }, error: null };
          }
          return { data: null, error: { message: 'Invalid credentials' } };
        }),
        signOut: vi.fn(async () => {
          mockSession = null;
          return { error: null };
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
    })),
    __setMockSession: (session: MockSession | null) => {
      mockSession = session;
    },
    __getMockSession: () => mockSession,
  };
});

import { getSession, getCurrentUser, signIn, signOut } from '../lib/supabase';

describe('Property Test: Session Restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up session after each test
    await signOut();
  });

  it('should restore session for any authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 6, maxLength: 20 }),
        }),
        async (credentials) => {
          // Step 1: User signs in
          const signInResult = await signIn(credentials.email, credentials.password);
          expect(signInResult.error).toBeNull();
          expect(signInResult.data).toBeDefined();

          // Step 2: Simulate user returning - session should be restored
          const sessionResult = await getSession();
          expect(sessionResult.error).toBeNull();
          expect(sessionResult.session).toBeDefined();
          expect(sessionResult.session?.user.email).toBe(credentials.email);

          // Step 3: Verify user can be retrieved without re-login
          const currentUser = await getCurrentUser();
          expect(currentUser).toBeDefined();
          expect(currentUser?.email).toBe(credentials.email);

          // Clean up
          await signOut();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null session when no user is authenticated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Ensure no session exists
          await signOut();

          // Try to get session
          const sessionResult = await getSession();
          expect(sessionResult.session).toBeNull();

          // Try to get current user
          const currentUser = await getCurrentUser();
          expect(currentUser).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain session across multiple getSession calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 6, maxLength: 20 }),
          numCalls: fc.integer({ min: 2, max: 10 }),
        }),
        async ({ email, password, numCalls }) => {
          // Sign in once
          await signIn(email, password);

          // Call getSession multiple times
          const sessions = await Promise.all(
            Array.from({ length: numCalls }, () => getSession())
          );

          // All calls should return the same session
          sessions.forEach((result) => {
            expect(result.error).toBeNull();
            expect(result.session).toBeDefined();
            expect(result.session?.user.email).toBe(email);
          });

          // Clean up
          await signOut();
        }
      ),
      { numRuns: 100 }
    );
  });
});
