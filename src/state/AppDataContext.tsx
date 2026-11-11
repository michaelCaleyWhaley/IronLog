import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AppData } from '../domain/types';
import type { DataRepository } from '../storage/dataRepository';
import { getRepository } from '../storage/repository';

export type AppDataStatus = 'loading' | 'ready' | 'error';

interface AppDataContextValue {
  status: AppDataStatus;
  data: AppData | null;
  error: unknown;
  reload: () => Promise<void>;
  /** Runs a repository mutation, refreshes, and returns the result. */
  mutate: <T>(fn: (repo: DataRepository) => Promise<T>) => Promise<T>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppDataStatus>('loading');
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setData(getRepository().getData());
    setStatus('ready');
  }, []);

  const mutate = useCallback(
    async <T,>(fn: (repo: DataRepository) => Promise<T>): Promise<T> => {
      const result = await fn(getRepository());
      await reload();
      return result;
    },
    [reload],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getRepository().initialise();
        if (!cancelled) {
          await reload();
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught);
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const value = useMemo<AppDataContextValue>(
    () => ({ status, data, error, reload, mutate }),
    [status, data, error, reload, mutate],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
