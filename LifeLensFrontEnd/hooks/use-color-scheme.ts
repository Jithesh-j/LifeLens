import { useContext } from 'react';
import { ThemeContext } from '@/context/theme-context';

export function useColorScheme() {
  const context = useContext(ThemeContext);
  return context ? context.colorScheme : 'dark';
}
