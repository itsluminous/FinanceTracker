'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBalanceVisibility } from '@/components/balance-visibility';

/**
 * Eye toggle for the top nav. Icon-only on mobile, icon + label on desktop.
 * While balances are visible the icon and label flip to the "hide" state.
 */
export function BalanceVisibilityToggle() {
  const { balancesVisible, toggleBalances } = useBalanceVisibility();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await toggleBalances();
    } finally {
      setBusy(false);
    }
  };

  const label = balancesVisible ? 'Hide balances' : 'Show balances';
  const Icon = balancesVisible ? EyeOff : Eye;

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={balancesVisible}
      aria-label={label}
      className="h-10 w-10 p-0 sm:w-auto sm:px-3 sm:gap-2"
    >
      <Icon className="h-5 w-5" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
