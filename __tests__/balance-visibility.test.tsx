import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import {
  BalanceVisibilityProvider,
  useBalanceVisibility,
  BALANCE_VISIBILITY_STORAGE_KEY,
  BALANCE_VISIBILITY_DURATION_MS,
  MASKED_BALANCE,
} from '@/components/balance-visibility';
import { BalanceVisibilityToggle } from '@/components/balance-visibility-toggle';

// Simple probe component that renders a balance respecting visibility
function BalanceProbe({ value }: { value: number }) {
  const { balancesVisible } = useBalanceVisibility();
  return (
    <span data-testid="balance">
      {balancesVisible ? `₹ ${value.toFixed(2)}` : MASKED_BALANCE}
    </span>
  );
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<BalanceVisibilityProvider>{ui}</BalanceVisibilityProvider>);
}

describe('Balance Visibility', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('default state', () => {
    it('hides balances by default on page load', () => {
      renderWithProvider(<BalanceProbe value={1000} />);
      expect(screen.getByTestId('balance')).toHaveTextContent(MASKED_BALANCE);
    });

    it('hides balances when used outside the provider (safe default)', () => {
      render(<BalanceProbe value={1000} />);
      expect(screen.getByTestId('balance')).toHaveTextContent(MASKED_BALANCE);
    });
  });

  describe('toggle button', () => {
    it('shows "Show balances" label and reveals on click', async () => {
      renderWithProvider(
        <>
          <BalanceVisibilityToggle />
          <BalanceProbe value={1000} />
        </>
      );

      const button = screen.getByRole('button', { name: 'Show balances' });
      expect(button).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('balance')).toHaveTextContent('₹ 1000.00');
        expect(
          screen.getByRole('button', { name: 'Hide balances' })
        ).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('hides balances again when toggled off', async () => {
      renderWithProvider(
        <>
          <BalanceVisibilityToggle />
          <BalanceProbe value={1000} />
        </>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Show balances' }));
      await waitFor(() =>
        expect(screen.getByTestId('balance')).toHaveTextContent('₹ 1000.00')
      );

      fireEvent.click(screen.getByRole('button', { name: 'Hide balances' }));
      await waitFor(() =>
        expect(screen.getByTestId('balance')).toHaveTextContent(MASKED_BALANCE)
      );
    });
  });

  describe('session persistence and 15-minute expiry', () => {
    it('persists an expiry timestamp in sessionStorage when revealed', async () => {
      const before = Date.now();
      renderWithProvider(<BalanceVisibilityToggle />);

      fireEvent.click(screen.getByRole('button', { name: 'Show balances' }));

      await waitFor(() => {
        const raw = sessionStorage.getItem(BALANCE_VISIBILITY_STORAGE_KEY);
        expect(raw).not.toBeNull();
        const { expiresAt } = JSON.parse(raw!);
        expect(expiresAt).toBeGreaterThanOrEqual(before + BALANCE_VISIBILITY_DURATION_MS);
        expect(expiresAt).toBeLessThanOrEqual(Date.now() + BALANCE_VISIBILITY_DURATION_MS);
      });
    });

    it('restores visibility from an unexpired session entry', () => {
      sessionStorage.setItem(
        BALANCE_VISIBILITY_STORAGE_KEY,
        JSON.stringify({ expiresAt: Date.now() + 5 * 60 * 1000 })
      );
      renderWithProvider(<BalanceProbe value={1000} />);
      expect(screen.getByTestId('balance')).toHaveTextContent('₹ 1000.00');
    });

    it('stays hidden and clears an expired session entry', () => {
      sessionStorage.setItem(
        BALANCE_VISIBILITY_STORAGE_KEY,
        JSON.stringify({ expiresAt: Date.now() - 1000 })
      );
      renderWithProvider(<BalanceProbe value={1000} />);
      expect(screen.getByTestId('balance')).toHaveTextContent(MASKED_BALANCE);
      expect(sessionStorage.getItem(BALANCE_VISIBILITY_STORAGE_KEY)).toBeNull();
    });

    it('automatically hides balances after 15 minutes', async () => {
      vi.useFakeTimers();
      renderWithProvider(
        <>
          <BalanceVisibilityToggle />
          <BalanceProbe value={1000} />
        </>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Show balances' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId('balance')).toHaveTextContent('₹ 1000.00');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BALANCE_VISIBILITY_DURATION_MS + 1000);
      });

      expect(screen.getByTestId('balance')).toHaveTextContent(MASKED_BALANCE);
      expect(sessionStorage.getItem(BALANCE_VISIBILITY_STORAGE_KEY)).toBeNull();
    });
  });

  describe('device-owner (screen lock) check on touch devices', () => {
    const stubTouchDevice = () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    };

    it('keeps balances hidden when the user fails/cancels the screen lock check', async () => {
      stubTouchDevice();
      vi.stubGlobal('isSecureContext', true);
      vi.stubGlobal('PublicKeyCredential', {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      });
      const create = vi
        .fn()
        .mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'));
      vi.stubGlobal('navigator', { ...window.navigator, credentials: { create } });

      renderWithProvider(
        <>
          <BalanceVisibilityToggle />
          <BalanceProbe value={1000} />
        </>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Show balances' }));

      await waitFor(() => expect(create).toHaveBeenCalled());
      expect(screen.getByTestId('balance')).toHaveTextContent(MASKED_BALANCE);
      expect(sessionStorage.getItem(BALANCE_VISIBILITY_STORAGE_KEY)).toBeNull();
    });

    it('reveals balances when the screen lock check passes', async () => {
      stubTouchDevice();
      vi.stubGlobal('isSecureContext', true);
      vi.stubGlobal('PublicKeyCredential', {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      });
      const create = vi.fn().mockResolvedValue({});
      vi.stubGlobal('navigator', { ...window.navigator, credentials: { create } });

      renderWithProvider(
        <>
          <BalanceVisibilityToggle />
          <BalanceProbe value={1000} />
        </>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Show balances' }));

      await waitFor(() => {
        expect(create).toHaveBeenCalled();
        expect(screen.getByTestId('balance')).toHaveTextContent('₹ 1000.00');
      });
    });

    it('falls back to revealing when no platform authenticator is available', async () => {
      stubTouchDevice();
      vi.stubGlobal('isSecureContext', true);
      vi.stubGlobal('PublicKeyCredential', {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(false),
      });

      renderWithProvider(
        <>
          <BalanceVisibilityToggle />
          <BalanceProbe value={1000} />
        </>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Show balances' }));

      await waitFor(() =>
        expect(screen.getByTestId('balance')).toHaveTextContent('₹ 1000.00')
      );
    });
  });
});
