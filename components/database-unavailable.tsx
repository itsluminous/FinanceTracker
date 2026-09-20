'use client';

import { useState } from 'react';
import { DatabaseZap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Shown when the Supabase backend is unreachable — most commonly because a
 * free-tier project has been paused after a week of inactivity.
 */
export function DatabaseUnavailable() {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <DatabaseZap
              className="h-6 w-6 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
          </div>
          <CardTitle>Database is unavailable</CardTitle>
          <CardDescription>
            We couldn&apos;t connect to the database right now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The database may be paused due to inactivity. If you&apos;re the
            administrator, restore the project from the Supabase dashboard and
            try again in a minute. Otherwise, please check back later.
          </p>
          <Button onClick={handleRetry} disabled={retrying} className="w-full">
            <RefreshCw
              className={`mr-2 h-4 w-4 ${retrying ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {retrying ? 'Retrying…' : 'Try again'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
