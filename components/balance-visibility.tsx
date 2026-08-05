'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** sessionStorage key holding the visibility expiry timestamp. */
export const BALANCE_VISIBILITY_STORAGE_KEY = 'finance-tracker-balance-visibility';

/** How long balances stay visible before automatically hiding again. */
export const BALANCE_VISIBILITY_DURATION_MS = 15 * 60 * 1000;

/** Placeholder rendered in place of any monetary amount while balances are hidden. */
export const MASKED_BALANCE = '₹ ••••••';

/** Short placeholder for tight spots like chart axis ticks. */
export const MASKED_BALANCE_COMPACT = '₹••';

interface BalanceVisibilityContextValue {
  balancesVisible: boolean;
  /** Reveals balances (after device-owner check on touch devices). Resolves true if revealed. */
  showBalances: () => Promise<boolean>;
  hideBalances: () => void;
  toggleBalances: () => Promise<boolean>;
}

// Default value means components render safely (masked) even outside the provider.
const BalanceVisibilityContext = createContext<BalanceVisibilityContextValue>({
  balancesVisible: false,
  showBalances: async () => false,
  hideBalances: () => {},
  toggleBalances: async () => false,
});

function readStoredExpiry(): number | null {
  try {
    const raw = sessionStorage.getItem(BALANCE_VISIBILITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: unknown };
    return typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null;
  } catch {
    return null;
  }
}

/**
 * On touch devices, ask the OS to verify the device owner (biometric, falling
 * back to the device pattern/PIN) via the WebAuthn platform authenticator
 * before revealing balances.
 *
 * Best effort by design:
 * - Device/browser cannot perform the check (no secure context, no platform
 *   authenticator, no screen lock set up) → allow the reveal.
 * - User cancels or fails the screen-lock prompt → keep balances hidden.
 */
async function verifyDeviceOwner(): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  const isTouchDevice = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  if (!isTouchDevice) return true;

  if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials?.create) {
    return true;
  }

  try {
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return true;

    // Creating a throwaway, non-resident platform credential forces the OS
    // screen-lock prompt (Face ID / fingerprint, with PIN/pattern fallback).
    // The credential is never stored or used for anything else.
    await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Finance Tracker' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'balance-visibility-check',
          displayName: 'Balance visibility check',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    });
    return true;
  } catch (error) {
    // NotAllowedError = the user cancelled or failed the screen-lock check.
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return false;
    }
    // Anything else (unsupported API, quirks) — don't lock the user out.
    return true;
  }
}

export function BalanceVisibilityProvider({ children }: { children: ReactNode }) {
  const [balancesVisible, setBalancesVisible] = useState(false);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideBalances = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    setBalancesVisible(false);
    try {
      sessionStorage.removeItem(BALANCE_VISIBILITY_STORAGE_KEY);
    } catch {
      // sessionStorage unavailable — in-memory state is still hidden.
    }
  }, []);

  const scheduleExpiry = useCallback(
    (expiresAt: number) => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
      }
      expiryTimerRef.current = setTimeout(hideBalances, Math.max(0, expiresAt - Date.now()));
    },
    [hideBalances]
  );

  // Restore visibility from the session on mount (page reloads within 15 min).
  // Restoring must happen post-hydration — sessionStorage doesn't exist during
  // SSR, so seeding useState with it would cause a hydration mismatch.
  useEffect(() => {
    const expiresAt = readStoredExpiry();
    if (expiresAt !== null && expiresAt > Date.now()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-hydration restore from sessionStorage
      setBalancesVisible(true);
      scheduleExpiry(expiresAt);
    } else if (expiresAt !== null) {
      try {
        sessionStorage.removeItem(BALANCE_VISIBILITY_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return () => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, [scheduleExpiry]);

  // Timers can be throttled/suspended in background tabs — re-check the expiry
  // whenever the tab becomes visible again so stale balances never linger.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      const expiresAt = readStoredExpiry();
      if (expiresAt === null || expiresAt <= Date.now()) {
        setBalancesVisible((visible) => {
          if (visible) hideBalances();
          return false;
        });
      }
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [hideBalances]);

  const showBalances = useCallback(async () => {
    const verified = await verifyDeviceOwner();
    if (!verified) return false;

    const expiresAt = Date.now() + BALANCE_VISIBILITY_DURATION_MS;
    try {
      sessionStorage.setItem(BALANCE_VISIBILITY_STORAGE_KEY, JSON.stringify({ expiresAt }));
    } catch {
      // sessionStorage unavailable — visibility just won't survive a reload.
    }
    setBalancesVisible(true);
    scheduleExpiry(expiresAt);
    return true;
  }, [scheduleExpiry]);

  const toggleBalances = useCallback(async () => {
    if (balancesVisible) {
      hideBalances();
      return false;
    }
    return showBalances();
  }, [balancesVisible, hideBalances, showBalances]);

  return (
    <BalanceVisibilityContext.Provider
      value={{ balancesVisible, showBalances, hideBalances, toggleBalances }}
    >
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility() {
  return useContext(BalanceVisibilityContext);
}
