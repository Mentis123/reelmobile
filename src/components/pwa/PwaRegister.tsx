'use client';

import { useEffect } from 'react';

import { ensureRegistered, isPwaEnvironment } from './registration';

export function PwaRegister() {
  useEffect(() => {
    if (!isPwaEnvironment()) return;
    ensureRegistered();
  }, []);

  return null;
}
