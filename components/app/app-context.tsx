'use client';
import { createContext, useContext } from 'react';
import type { useStrideApp } from './use-stride-app';

const AppContext = createContext<ReturnType<typeof useStrideApp> | null>(null);
export const AppProvider = AppContext.Provider;
export function useAppContext() {
  const app = useContext(AppContext);
  if (!app) throw new Error('Stride app views require AppProvider.');
  return app;
}
