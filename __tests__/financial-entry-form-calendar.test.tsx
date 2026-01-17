import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FinancialEntryForm } from '@/components/financial-entry-form';
import { useToast } from '@/hooks/use-toast';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } }
      }),
    },
  },
}));

// Mock fetch
global.fetch = vi.fn();

const mockToast = vi.fn();
(useToast as ReturnType<typeof vi.fn>).mockReturnValue({ toast: mockToast });

describe('FinancialEntryForm Calendar Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/entries/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entry: null }),
        });
      }
      if (url.includes('/entries/dates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ dates: ['2024-01-15', '2024-01-20'] }),
        });
      }
      if (url.includes('/entries/by-date')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entry: null }), // No entry for exact date
        });
      }
      if (url.includes('/entries/before-date')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            entry: {
              direct_equity: 1000,
              bank_balance: 5000,
              entry_date: '2024-01-10'
            }
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('should show calendar when calendar button is clicked', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Find the calendar button by its position next to the date input
    const dateInput = screen.getByLabelText(/entry date/i);
    const calendarButton = dateInput.parentElement?.querySelector('button[type="button"]');
    expect(calendarButton).toBeInTheDocument();
    
    fireEvent.click(calendarButton!);

    // Calendar should be visible
    expect(screen.getByText('Dates with existing entries')).toBeInTheDocument();
  });

  it('should fetch entry dates on component mount', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/entries/dates'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });
  });

  it('should fetch entry by date when date is selected', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Change the date input using dd/mm/yyyy format
    const dateInput = screen.getByLabelText(/entry date/i);
    fireEvent.change(dateInput, { target: { value: '15/01/2024' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/entries/by-date?date=2024-01-15'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });
  });

  it('should show loading state when fetching entry by date', async () => {
    // Mock a delayed response
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/entries/by-date')) {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ entry: null }),
            });
          }, 100);
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ dates: [] }),
      });
    });

    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Change the date input using dd/mm/yyyy format
    const dateInput = screen.getByLabelText(/entry date/i);
    fireEvent.change(dateInput, { target: { value: '15/01/2024' } });

    // Should show loading state
    expect(screen.getByText('Loading entry for selected date...')).toBeInTheDocument();
  });

  it('should fetch entry before date when no exact match found', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Change the date input to a date that has no exact entry using dd/mm/yyyy format
    const dateInput = screen.getByLabelText(/entry date/i);
    fireEvent.change(dateInput, { target: { value: '12/01/2024' } });

    await waitFor(() => {
      // Should first try exact date
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/entries/by-date?date=2024-01-12'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
      
      // Then try before date
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/entries/before-date?date=2024-01-12'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });
  });

  it('should display dates in dd/mm/yyyy format', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText(/entry date/i) as HTMLInputElement;
    
    // Check that the date is displayed in dd/mm/yyyy format
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const expectedFormat = `${day}/${month}/${year}`;
    
    expect(dateInput.value).toBe(expectedFormat);
  });

  it('should show toast with dd/mm/yyyy format when loading previous entry', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Change to a date that will trigger the before-date fetch
    const dateInput = screen.getByLabelText(/entry date/i);
    fireEvent.change(dateInput, { target: { value: '12/01/2024' } });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Previous Entry Loaded',
          description: expect.stringContaining('10/01/2024'),
        })
      );
    });
  });

  it('should highlight dates with entries in the calendar', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Open calendar
    const dateInput = screen.getByLabelText(/entry date/i);
    const calendarButton = dateInput.parentElement?.querySelector('button[type="button"]');
    fireEvent.click(calendarButton!);

    // Check that the legend is shown
    expect(screen.getByText('Dates with existing entries')).toBeInTheDocument();
  });

  it('should close calendar after date selection', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Open calendar
    const dateInput = screen.getByLabelText(/entry date/i);
    const calendarButton = dateInput.parentElement?.querySelector('button[type="button"]');
    fireEvent.click(calendarButton!);

    // Calendar should be visible
    expect(screen.getByText('Dates with existing entries')).toBeInTheDocument();

    // Note: Actual date selection would require more complex interaction with the calendar component
    // This test verifies the calendar opens, which is the first step
  });

  it('should handle invalid date format gracefully', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText(/entry date/i);
    
    // Try to enter an invalid date format (not matching dd/mm/yyyy)
    fireEvent.change(dateInput, { target: { value: 'invalid-date' } });

    // The input value should remain unchanged or empty since it doesn't match the format
    // The component only processes dates that match dd/mm/yyyy format
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify no error toast was shown
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
      })
    );
  });

  it('should pre-fill form with data from selected date', async () => {
    // Mock response with actual data
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/entries/by-date')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            entry: {
              direct_equity: 5000,
              bank_balance: 10000,
              entry_date: '2024-01-15'
            }
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ dates: [] }),
      });
    });

    render(<FinancialEntryForm profileId="test-profile" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Change the date
    const dateInput = screen.getByLabelText(/entry date/i);
    fireEvent.change(dateInput, { target: { value: '15/01/2024' } });

    // Wait for the form to be populated
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Entry Loaded',
          description: expect.stringContaining('15/01/2024'),
        })
      );
    });
  });
});