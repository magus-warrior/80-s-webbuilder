import type { CSSProperties, ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

import type { ThemeToken } from '../../models';

type ThemeContextValue = {
  tokens: ThemeToken[];
  updateTokenValue: (name: string, value: string) => void;
  cssVariables: CSSProperties;
};

type ThemeProviderProps = {
  tokens: ThemeToken[];
  onTokensChange: (tokens: ThemeToken[]) => void;
  children: ReactNode;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const toCssVariableName = (tokenName: string) => {
  const normalized = tokenName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `--theme-${normalized || 'token'}`;
};

const buildCssVariables = (tokens: ThemeToken[]) =>
  tokens.reduce<CSSProperties>((vars, token) => {
    vars[toCssVariableName(token.name)] = token.value;
    return vars;
  }, {});

export function ThemeProvider({ tokens, onTokensChange, children }: ThemeProviderProps) {
  const cssVariables = useMemo(() => buildCssVariables(tokens), [tokens]);

  const updateTokenValue = (name: string, value: string) => {
    onTokensChange(
      tokens.map((token) => (token.name === name ? { ...token, value } : token))
    );
  };

  return (
    <ThemeContext.Provider value={{ tokens, updateTokenValue, cssVariables }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
