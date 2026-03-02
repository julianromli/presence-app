'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';

export function UserSyncBootstrap() {
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    void fetch('/api/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }, [isLoaded, isSignedIn]);

  return null;
}
