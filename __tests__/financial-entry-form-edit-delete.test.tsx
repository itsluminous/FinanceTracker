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

// Mock cache manager
vi.mock('@/lib/cache', () => ({
  clearAllCache: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

const mockToast = vi.fn();
(useToast as ReturnType<typeof vi.fn>).mockReturnValue({ toast: mockToast });

describe('FinancialEntryForm Edit/Delete Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock responses
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
          json: () => Promise.resolve({ dates: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('should show "Save Entry" button by default for new entries', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Should show save button for new entry
    expect(screen.getByText('Save Entry')).toBeInTheDocument();
    expect(screen.queryByText('Update Entry')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Entry')).not.toBeInTheDocument();
  });

  it('should call POST endpoint when creating new entry', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/entries/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entry: null }),
        });
      }
      if (url.includes('/entries/dates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ dates: [] }),
        });
      }
      if (url.includes('/entries') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entry: { id: 'new-entry-id' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Submit the form
    const saveButton = screen.getByText('Save Entry');
    fireEvent.click(saveButton);

    // Should call POST endpoint
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/profiles/test-profile/entries'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });
  });

  it('should show success toast after successful save', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/entries/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entry: null }),
        });
      }
      if (url.includes('/entries/dates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ dates: [] }),
        });
      }
      if (url.includes('/entries') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entry: { id: 'new-entry-id' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Submit the form
    const saveButton = screen.getByText('Save Entry');
    fireEvent.click(saveButton);

    // Should show success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
          description: 'Financial entry saved successfully',
        })
      );
    });
  });

  it('should handle valid input properly', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add valid values
    const directEquityInput = screen.getByLabelText(/Direct Equity/i);
    fireEvent.change(directEquityInput, { target: { value: '100.12' } });
    
    // Submit the form
    const saveButton = screen.getByText('Save Entry');
    fireEvent.click(saveButton);

    // Should show success toast since all values are valid
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
          description: 'Financial entry saved successfully',
        })
      );
    });
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/entries/latest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ entry: null }),
        });
      }
      if (url.includes('/entries/dates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ dates: [] }),
        });
      }
      if (url.includes('/entries') && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: 'An entry for this date already exists' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Submit the form
    const saveButton = screen.getByText('Save Entry');
    fireEvent.click(saveButton);

    // Should show error toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'An entry for this date already exists',
          variant: 'destructive',
        })
      );
    });
  });

  it('should show card title as "Financial Entry" by default', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Should show default title
    expect(screen.getByText('Financial Entry')).toBeInTheDocument();
  });

  it('should format date input correctly', async () => {
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

  it('should have proper form structure and fields', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check for main sections
    expect(screen.getByText('High/Medium Risk Assets')).toBeInTheDocument();
    expect(screen.getByText('Low Risk Assets')).toBeInTheDocument();
    
    // Check for some key fields
    expect(screen.getByLabelText(/Direct Equity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bank Balance/i)).toBeInTheDocument();
    
    // Check for totals section
    expect(screen.getByText('Total Assets:')).toBeInTheDocument();
  });

  it('should calculate totals correctly', async () => {
    render(<FinancialEntryForm profileId="test-profile" />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Add some values
    const directEquityInput = screen.getByLabelText(/Direct Equity/i);
    const bankBalanceInput = screen.getByLabelText(/Bank Balance/i);
    
    fireEvent.change(directEquityInput, { target: { value: '1000' } });
    fireEvent.change(bankBalanceInput, { target: { value: '2000' } });

    // Check totals are calculated
    await waitFor(() => {
      expect(screen.getByText('₹ 1000.00')).toBeInTheDocument(); // High/Medium Risk total
      expect(screen.getByText('₹ 2000.00')).toBeInTheDocument(); // Low Risk total
      expect(screen.getByText('₹ 3000.00')).toBeInTheDocument(); // Total Assets
    });
  });
});