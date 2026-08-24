import { useContext } from 'react';
import { AppContext, type AppContextValue } from './AppContextDefinition';

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
