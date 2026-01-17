import type { CSSProperties, ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

import type { ThemeToken } from '../../models';

type ThemeContextValue = {
  tokens: ThemeToken[];
  updateTokenValue: (name: string, value: string) => void;
  applyTokens: (
    nextTokens: ThemeToken[],
    options?: { preserveExistingValues?: boolean }
  ) => void;
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

  const applyTokens = (
    nextTokens: ThemeToken[],
    options?: { preserveExistingValues?: boolean }
  ) => {
    if (!options?.preserveExistingValues) {
      onTokensChange(nextTokens);
      return;
    }
    const existingValues = new Map(tokens.map((token) => [token.name, token.value]));
    onTokensChange(
      nextTokens.map((token) => ({
        ...token,
        value: existingValues.get(token.name) ?? token.value
      }))
    );
  };

  return (
    <ThemeContext.Provider value={{ tokens, updateTokenValue, applyTokens, cssVariables }}>
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
