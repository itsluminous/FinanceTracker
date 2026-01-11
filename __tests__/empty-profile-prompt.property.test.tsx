import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: 'mock-token' } },
          error: null,
        })),
      },
    })),
  };
});

// Mock fetch for API calls
interface MockProfile {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

let mockProfiles: MockProfile[] = [];

global.fetch = vi.fn((url: string) => {
  if (url === '/api/profiles') {
    return Promise.resolve({
      ok: true,
      json: async () => ({ profiles: mockProfiles }),
    } as Response);
  }
  return Promise.resolve({
    ok: false,
    json: async () => ({ error: 'Not found' }),
  } as Response);
});

import { ProfileSelector } from '../components/profile-selector';

describe('Property Test: Empty Profile Prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfiles = [];
  });

  afterEach(() => {
    mockProfiles = [];
  });

  it('should display a prompt to add profiles when user has no linked profiles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // userId not used in this test but kept for consistency with property test patterns
          userId: fc.uuid(),
        }),
        async () => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          
          // Clean up any previous renders
          cleanup();

          // Render the ProfileSelector component
          const mockOnProfileSelect = vi.fn();
          const mockOnAddProfile = vi.fn();

          const { container } = render(
            <ProfileSelector
              onProfileSelect={mockOnProfileSelect}
              onAddProfile={mockOnAddProfile}
            />
          );

          // Wait for component to load
          await new Promise(resolve => setTimeout(resolve, 100));

          // Verification: Should display "No Profiles Found" message
          const noProfilesText = await screen.findByText(/No Profiles Found/i, {}, { timeout: 1000 });
          expect(noProfilesText).toBeInTheDocument();

          // Verification: Should display prompt message
          const promptText = screen.getByText(/You don't have any profiles yet/i);
          expect(promptText).toBeInTheDocument();

          // Verification: Should display "Add Your First Profile" button
          const addButton = screen.getByText(/Add Your First Profile/i);
          expect(addButton).toBeInTheDocument();

          // Verification: Should NOT display profile selection dropdown
          const selectTrigger = container.querySelector('[role="combobox"]');
          expect(selectTrigger).not.toBeInTheDocument();
          
          // Clean up after this iteration
          cleanup();
        }
      ),
      { numRuns: 10 } // Reduced from 100 for React component tests
    );
  }, 10000); // Increased timeout for React component tests

  it('should NOT display empty prompt when user has at least one profile', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          profiles: fc.array(
            fc.record({
              id: fc.uuid(),
              // Generate longer alphanumeric strings to avoid single-letter matches in other UI elements
              name: fc.stringMatching(/^[a-zA-Z0-9]{2,}$/).filter(s => s.length >= 2 && s.length <= 100),
              created_at: fc.integer({ min: 0, max: 10000 }).map(days => {
                const date = new Date('2020-01-01');
                date.setDate(date.getDate() + days);
                return date.toISOString();
              }),
              updated_at: fc.integer({ min: 0, max: 10000 }).map(days => {
                const date = new Date('2020-01-01');
                date.setDate(date.getDate() + days);
                return date.toISOString();
              }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ profiles }) => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          
          // Clean up any previous renders
          cleanup();
          
          // Setup: User has linked profiles
          mockProfiles = profiles;

          // Render the ProfileSelector component
          const mockOnProfileSelect = vi.fn();
          const mockOnAddProfile = vi.fn();

          const { container } = render(
            <ProfileSelector
              onProfileSelect={mockOnProfileSelect}
              onAddProfile={mockOnAddProfile}
            />
          );

          // Wait for component to fully load and update with profiles
          // Use findByText which waits for the element to appear
          const selectLabel = await screen.findByText(/Select Profile/i, {}, { timeout: 2000 });
          expect(selectLabel).toBeInTheDocument();

          // Verification: Should NOT display "No Profiles Found" message
          const noProfilesText = screen.queryByText(/No Profiles Found/i);
          expect(noProfilesText).not.toBeInTheDocument();

          // Verification: Should display "Add New Profile" button (not "Add Your First Profile")
          const addButton = screen.getByText(/Add New Profile/i);
          expect(addButton).toBeInTheDocument();
          
          // Verify that at least one profile name is displayed in the card grid
          // Query within the card grid container to avoid matching text in other UI elements
          const cardGrid = container.querySelector('.md\\:grid');
          expect(cardGrid).toBeInTheDocument();
          expect(cardGrid?.textContent).toContain(profiles[0].name);
          
          // Clean up after this iteration
          cleanup();
        }
      ),
      { numRuns: 10 } // Reduced from 100 for React component tests
    );
  }, 15000); // Increased timeout for React component tests with better waiting

  it('should transition from empty state to profile list when first profile is added', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          profileId: fc.uuid(),
          // Generate longer alphanumeric strings to avoid single-letter matches in other UI elements
          profileName: fc.stringMatching(/^[a-zA-Z0-9]{2,}$/).filter(s => s.length >= 2 && s.length <= 100),
        }),
        async ({ profileId, profileName }) => {
          // Clear mock state for this property test iteration
          mockProfiles = [];
          
          // Clean up any previous renders
          cleanup();

          // Render the ProfileSelector component
          const mockOnProfileSelect = vi.fn();
          const mockOnAddProfile = vi.fn();

          render(
            <ProfileSelector
              onProfileSelect={mockOnProfileSelect}
              onAddProfile={mockOnAddProfile}
            />
          );

          // Wait for component to load and verify empty state
          const noProfilesText = await screen.findByText(/No Profiles Found/i, {}, { timeout: 2000 });
          expect(noProfilesText).toBeInTheDocument();

          // Action: Add a profile and unmount/remount to simulate refresh
          mockProfiles = [{
            id: profileId,
            name: profileName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }];

          // Unmount the component
          cleanup();

          // Re-mount the component with new data
          const { container: container2 } = render(
            <ProfileSelector
              onProfileSelect={mockOnProfileSelect}
              onAddProfile={mockOnAddProfile}
            />
          );

          // Wait for component to update with profiles
          const selectLabel = await screen.findByText(/Select Profile/i, {}, { timeout: 2000 });
          expect(selectLabel).toBeInTheDocument();

          // Verification: Should NOT display empty state anymore
          const noProfilesTextAfter = screen.queryByText(/No Profiles Found/i);
          expect(noProfilesTextAfter).not.toBeInTheDocument();

          // Verify the profile name is displayed in the card grid
          // Query within the card grid container to avoid matching text in other UI elements
          const cardGrid = container2.querySelector('.md\\:grid');
          expect(cardGrid).toBeInTheDocument();
          expect(cardGrid?.textContent).toContain(profileName);
          
          // Clean up after this iteration
          cleanup();
        }
      ),
      { numRuns: 10 } // Reduced from 100 for React component tests
    );
  }, 15000); // Increased timeout for React component tests with better waiting
});
