import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FinanceAssistantChat,
  parseAmountExpression,
  formatIndianNumber,
} from '@/components/finance-assistant-chat';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
      }),
    },
  },
}));

// Mock cache
vi.mock('@/lib/cache', () => ({
  clearAllCache: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('parseAmountExpression', () => {
  it('should parse simple integers', () => {
    expect(parseAmountExpression('1000')).toBe(1000);
    expect(parseAmountExpression('0')).toBe(0);
    expect(parseAmountExpression('123456')).toBe(123456);
  });

  it('should parse numbers with Indian-style commas', () => {
    expect(parseAmountExpression('13,67,986')).toBe(1367986);
    expect(parseAmountExpression('1,82,528')).toBe(182528);
    expect(parseAmountExpression('12,89,502')).toBe(1289502);
    expect(parseAmountExpression('1,32,05,645')).toBe(13205645);
  });

  it('should parse numbers with Western-style commas', () => {
    expect(parseAmountExpression('1,000,000')).toBe(1000000);
    expect(parseAmountExpression('100,000')).toBe(100000);
  });

  it('should parse decimal numbers', () => {
    expect(parseAmountExpression('96796.98')).toBe(96796.98);
    expect(parseAmountExpression('4267.25')).toBe(4267.25);
    expect(parseAmountExpression('96,796.98')).toBe(96796.98);
  });

  it('should evaluate addition expressions', () => {
    expect(parseAmountExpression('12,89,502 + 8,64,670')).toBe(2154172);
    expect(parseAmountExpression('1000 + 2000 + 3000')).toBe(6000);
    expect(parseAmountExpression('96796.98 + 4267.25 + 118972')).toBe(220036.23);
  });

  it('should evaluate subtraction expressions', () => {
    expect(parseAmountExpression('13,67,986 - 29891 - 1,82,528')).toBe(1155567);
  });

  it('should evaluate multiplication expressions', () => {
    expect(parseAmountExpression('1000 * 5')).toBe(5000);
  });

  it('should evaluate mixed expressions', () => {
    expect(parseAmountExpression('14,23,867 + 1,82,000 + 1,50,000')).toBe(1755867);
  });

  it('should handle expressions with parentheses', () => {
    expect(parseAmountExpression('(1000 + 2000) * 3')).toBe(9000);
  });

  it('should return NaN for invalid input', () => {
    expect(parseAmountExpression('abc')).toBeNaN();
    expect(parseAmountExpression('hello world')).toBeNaN();
    expect(parseAmountExpression('')).toBeNaN();
    expect(parseAmountExpression('12,89,502 + abc')).toBeNaN();
  });

  it('should reject potentially unsafe input', () => {
    expect(parseAmountExpression('alert("hi")')).toBeNaN();
    expect(parseAmountExpression('process.exit()')).toBeNaN();
    expect(parseAmountExpression('require("fs")')).toBeNaN();
  });

  it('should round to 2 decimal places', () => {
    expect(parseAmountExpression('100.999')).toBe(101);
    expect(parseAmountExpression('1.006')).toBe(1.01);
    expect(parseAmountExpression('10 / 3')).toBe(3.33);
  });
});

describe('formatIndianNumber', () => {
  it('should format zero', () => {
    expect(formatIndianNumber(0)).toBe('0');
  });

  it('should format numbers less than 1000 without commas', () => {
    expect(formatIndianNumber(999)).toBe('999');
    expect(formatIndianNumber(100)).toBe('100');
    expect(formatIndianNumber(5)).toBe('5');
  });

  it('should format thousands with Indian grouping', () => {
    expect(formatIndianNumber(1000)).toBe('1,000');
    expect(formatIndianNumber(10000)).toBe('10,000');
    expect(formatIndianNumber(99999)).toBe('99,999');
  });

  it('should format lakhs correctly', () => {
    expect(formatIndianNumber(100000)).toBe('1,00,000');
    expect(formatIndianNumber(1367986)).toBe('13,67,986');
    expect(formatIndianNumber(1155567)).toBe('11,55,567');
    expect(formatIndianNumber(212419)).toBe('2,12,419');
  });

  it('should format crores correctly', () => {
    expect(formatIndianNumber(10000000)).toBe('1,00,00,000');
    expect(formatIndianNumber(13205645)).toBe('1,32,05,645');
  });

  it('should handle decimal values', () => {
    expect(formatIndianNumber(96796.98)).toBe('96,796.98');
    expect(formatIndianNumber(4267.25)).toBe('4,267.25');
    expect(formatIndianNumber(1042925.72)).toBe('10,42,925.72');
  });

  it('should drop .00 decimals', () => {
    expect(formatIndianNumber(800000)).toBe('8,00,000');
    expect(formatIndianNumber(1000)).toBe('1,000');
  });

  it('should handle negative numbers', () => {
    expect(formatIndianNumber(-1367986)).toBe('-13,67,986');
    expect(formatIndianNumber(-100)).toBe('-100');
  });
});

describe('FinanceAssistantChat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default mock: profiles API
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        profiles: [
          { id: 'profile-1', name: 'Alice' },
          { id: 'profile-2', name: 'Bob' },
        ],
      }),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should render floating chat button', () => {
    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);
    expect(screen.getByLabelText('Open finance assistant')).toBeInTheDocument();
  });

  it('should open chat panel when button is clicked', async () => {
    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open finance assistant'));
    });

    await waitFor(() => {
      expect(screen.getByText('Finance Assistant')).toBeInTheDocument();
    });
  });

  it('should show profile selection on start', async () => {
    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open finance assistant'));
    });

    await waitFor(() => {
      expect(screen.getByText('Which profile do you want to create or update data for?')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('should show date picker after profile selection', async () => {
    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open finance assistant'));
    });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Alice'));
    });

    await waitFor(() => {
      expect(screen.getByText('Which date do you want to create or update data for?')).toBeInTheDocument();
    });
  });

  it('should show error message for no profiles', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profiles: [] }),
    });

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open finance assistant'));
    });

    await waitFor(() => {
      expect(screen.getByText('No profiles found. Please create a profile first from the main page.')).toBeInTheDocument();
    });
  });

  it('should handle API failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    });

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open finance assistant'));
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load profiles. Please try again.')).toBeInTheDocument();
    });
  });

  it('should close chat panel when X is clicked', async () => {
    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open finance assistant'));
    });

    await waitFor(() => {
      expect(screen.getByText('Finance Assistant')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Close chat'));
    });

    // Should show floating button again
    expect(screen.getByLabelText('Open finance assistant')).toBeInTheDocument();
  });

  it('should show restart button in header', async () => {
    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open finance assistant'));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Restart conversation')).toBeInTheDocument();
    });
  });

  it('should persist session to localStorage', async () => {
    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open finance assistant'));
    });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Select a profile to advance the conversation
    await act(async () => {
      fireEvent.click(screen.getByText('Alice'));
    });

    // Wait for debounced save (300ms)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
    });

    const saved = localStorage.getItem('finance-assistant-session');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.step).toBe('select-date');
    expect(parsed.data.profileName).toBe('Alice');
    expect(parsed.timestamp).toBeGreaterThan(0);
  });

  it('should restore session from localStorage on mount', async () => {
    // Pre-set a session
    const session = {
      messages: [
        { id: '1', role: 'assistant', content: 'Which profile?', type: 'text' },
        { id: '2', role: 'user', content: 'Alice', type: 'text' },
        { id: '3', role: 'assistant', content: 'Which date?', type: 'date-picker' },
      ],
      step: 'select-date',
      data: {
        profileId: 'profile-1',
        profileName: 'Alice',
        entryDate: null,
        totalStocks: 0,
        goldInStocks: 0,
        silverInStocks: 0,
        totalMutualFunds: 0,
        arbitrageFunds: 0,
        banks: [],
        endowmentPlans: 0,
        nps: 0,
        epf: 0,
        ppf: 0,
        ulip: 0,
        realEstate: 0,
        realEstatesFunds: 0,
        privateEquity: 0,
        esops: 0,
        equityPms: 0,
        structuredProductsEquity: 0,
        structuredProductsDebt: 0,
      },
      currentBankName: '',
      isOpen: true,
      timestamp: Date.now(),
    };
    localStorage.setItem('finance-assistant-session', JSON.stringify(session));

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    // Should restore as open with existing messages
    await waitFor(() => {
      expect(screen.getByText('Finance Assistant')).toBeInTheDocument();
      expect(screen.getByText('Which date?')).toBeInTheDocument();
    });
  });

  it('should not restore expired session (older than 24h)', async () => {
    const session = {
      messages: [{ id: '1', role: 'assistant', content: 'Old message', type: 'text' }],
      step: 'stocks-total',
      data: {
        profileId: 'profile-1', profileName: 'Alice', entryDate: '2026-07-25',
        totalStocks: 0, goldInStocks: 0, silverInStocks: 0,
        totalMutualFunds: 0, arbitrageFunds: 0, banks: [],
        endowmentPlans: 0, nps: 0, epf: 0, ppf: 0, ulip: 0,
        realEstate: 0, realEstatesFunds: 0, privateEquity: 0,
        esops: 0, equityPms: 0, structuredProductsEquity: 0, structuredProductsDebt: 0,
      },
      currentBankName: '',
      isOpen: true,
      timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
    };
    localStorage.setItem('finance-assistant-session', JSON.stringify(session));

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    // Should NOT be open (session expired)
    expect(screen.getByLabelText('Open finance assistant')).toBeInTheDocument();
    expect(screen.queryByText('Old message')).not.toBeInTheDocument();
  });

  it('should handle network error during profile fetch', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open finance assistant'));
    });

    await waitFor(() => {
      expect(screen.getByText('Network error. Please check your connection and try again.')).toBeInTheDocument();
    });
  });
});

describe('FinanceAssistantChat Input Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        profiles: [{ id: 'profile-1', name: 'Alice' }],
      }),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should show error for invalid amount input', async () => {
    const user = userEvent.setup();

    // Pre-set session at stocks-total step
    const session = {
      messages: [
        { id: '1', role: 'assistant', content: 'Total stocks?', type: 'text' },
      ],
      step: 'stocks-total',
      data: {
        profileId: 'profile-1', profileName: 'Alice', entryDate: '2026-07-26',
        totalStocks: 0, goldInStocks: 0, silverInStocks: 0,
        totalMutualFunds: 0, arbitrageFunds: 0, banks: [],
        endowmentPlans: 0, nps: 0, epf: 0, ppf: 0, ulip: 0,
        realEstate: 0, realEstatesFunds: 0, privateEquity: 0,
        esops: 0, equityPms: 0, structuredProductsEquity: 0, structuredProductsDebt: 0,
      },
      currentBankName: '',
      isOpen: true,
      timestamp: Date.now(),
    };
    localStorage.setItem('finance-assistant-session', JSON.stringify(session));

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Total stocks?')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter amount (e.g. 13,67,986)');
    await user.type(input, 'not a number');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/couldn't understand that amount/i)).toBeInTheDocument();
    });
  });

  it('should show error for negative amounts', async () => {
    const user = userEvent.setup();

    const session = {
      messages: [
        { id: '1', role: 'assistant', content: 'Total stocks?', type: 'text' },
      ],
      step: 'stocks-total',
      data: {
        profileId: 'profile-1', profileName: 'Alice', entryDate: '2026-07-26',
        totalStocks: 0, goldInStocks: 0, silverInStocks: 0,
        totalMutualFunds: 0, arbitrageFunds: 0, banks: [],
        endowmentPlans: 0, nps: 0, epf: 0, ppf: 0, ulip: 0,
        realEstate: 0, realEstatesFunds: 0, privateEquity: 0,
        esops: 0, equityPms: 0, structuredProductsEquity: 0, structuredProductsDebt: 0,
      },
      currentBankName: '',
      isOpen: true,
      timestamp: Date.now(),
    };
    localStorage.setItem('finance-assistant-session', JSON.stringify(session));

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Total stocks?')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter amount (e.g. 13,67,986)');
    await user.type(input, '100 - 200');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument();
    });
  });

  it('should show error when gold exceeds total stocks', async () => {
    const user = userEvent.setup();

    const session = {
      messages: [
        { id: '1', role: 'assistant', content: 'How much in Gold?', type: 'text' },
      ],
      step: 'stocks-gold',
      data: {
        profileId: 'profile-1', profileName: 'Alice', entryDate: '2026-07-26',
        totalStocks: 1000000, goldInStocks: 0, silverInStocks: 0,
        totalMutualFunds: 0, arbitrageFunds: 0, banks: [],
        endowmentPlans: 0, nps: 0, epf: 0, ppf: 0, ulip: 0,
        realEstate: 0, realEstatesFunds: 0, privateEquity: 0,
        esops: 0, equityPms: 0, structuredProductsEquity: 0, structuredProductsDebt: 0,
      },
      currentBankName: '',
      isOpen: true,
      timestamp: Date.now(),
    };
    localStorage.setItem('finance-assistant-session', JSON.stringify(session));

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('How much in Gold?')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter amount (e.g. 13,67,986)');
    await user.type(input, '15,00,000');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/exceeds the total stocks/i)).toBeInTheDocument();
    });
  });

  it('should show error when arbitrage exceeds total MFs', async () => {
    const user = userEvent.setup();

    const session = {
      messages: [
        { id: '1', role: 'assistant', content: 'Arbitrage funds?', type: 'text' },
      ],
      step: 'mf-arbitrage',
      data: {
        profileId: 'profile-1', profileName: 'Alice', entryDate: '2026-07-26',
        totalStocks: 0, goldInStocks: 0, silverInStocks: 0,
        totalMutualFunds: 5000000, arbitrageFunds: 0, banks: [],
        endowmentPlans: 0, nps: 0, epf: 0, ppf: 0, ulip: 0,
        realEstate: 0, realEstatesFunds: 0, privateEquity: 0,
        esops: 0, equityPms: 0, structuredProductsEquity: 0, structuredProductsDebt: 0,
      },
      currentBankName: '',
      isOpen: true,
      timestamp: Date.now(),
    };
    localStorage.setItem('finance-assistant-session', JSON.stringify(session));

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Arbitrage funds?')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/12,89,502/);
    await user.type(input, '60,00,000');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/exceeds the total Mutual Funds/i)).toBeInTheDocument();
    });
  });

  it('should accept valid amount and advance to next step', async () => {
    const user = userEvent.setup();

    const session = {
      messages: [
        { id: '1', role: 'assistant', content: 'Total stocks?', type: 'text' },
      ],
      step: 'stocks-total',
      data: {
        profileId: 'profile-1', profileName: 'Alice', entryDate: '2026-07-26',
        totalStocks: 0, goldInStocks: 0, silverInStocks: 0,
        totalMutualFunds: 0, arbitrageFunds: 0, banks: [],
        endowmentPlans: 0, nps: 0, epf: 0, ppf: 0, ulip: 0,
        realEstate: 0, realEstatesFunds: 0, privateEquity: 0,
        esops: 0, equityPms: 0, structuredProductsEquity: 0, structuredProductsDebt: 0,
      },
      currentBankName: '',
      isOpen: true,
      timestamp: Date.now(),
    };
    localStorage.setItem('finance-assistant-session', JSON.stringify(session));

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Total stocks?')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter amount (e.g. 13,67,986)');
    await user.type(input, '13,67,986');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      // Should advance to asking about Gold
      expect(screen.getByText(/how much is in Gold/i)).toBeInTheDocument();
    });
  });

  it('should accept expression input and advance', async () => {
    const user = userEvent.setup();

    const session = {
      messages: [
        { id: '1', role: 'assistant', content: 'Arbitrage funds?', type: 'text' },
      ],
      step: 'mf-arbitrage',
      data: {
        profileId: 'profile-1', profileName: 'Alice', entryDate: '2026-07-26',
        totalStocks: 0, goldInStocks: 0, silverInStocks: 0,
        totalMutualFunds: 13205645, arbitrageFunds: 0, banks: [],
        endowmentPlans: 0, nps: 0, epf: 0, ppf: 0, ulip: 0,
        realEstate: 0, realEstatesFunds: 0, privateEquity: 0,
        esops: 0, equityPms: 0, structuredProductsEquity: 0, structuredProductsDebt: 0,
      },
      currentBankName: '',
      isOpen: true,
      timestamp: Date.now(),
    };
    localStorage.setItem('finance-assistant-session', JSON.stringify(session));

    render(<FinanceAssistantChat onEntrySaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Arbitrage funds?')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/12,89,502/);
    await user.type(input, '12,89,502 + 8,64,670');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      // Should advance to bank section
      expect(screen.getByText(/Bank Balance & Deposits/i)).toBeInTheDocument();
    });
  });
});
