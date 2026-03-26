import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  accent: string;
  shadow: string;
}

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
}

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_PREFERENCE_KEY = 'theme_preference';

const lightTheme: Theme = {
  isDark: false,
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    background: '#f8f9fa',
    surface: '#ffffff',
    card: '#ffffff',
    text: '#1a1a1a',
    textSecondary: '#666666',
    border: '#e9ecef',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    accent: '#667eea',
    shadow: '#000000',
  },
};

const darkTheme: Theme = {
  isDark: true,
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    background: '#121212',
    surface: '#1e1e1e',
    card: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#b3b3b3',
    border: '#404040',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    accent: '#667eea',
    shadow: '#000000',
  },
};

function resolveSystemTheme(colorScheme: ColorSchemeName): 'light' | 'dark' {
  return colorScheme === 'dark' ? 'dark' : 'light';
}

function parseThemeMode(value: unknown): ThemeMode | null {
  if (value === 'system' || value === 'light' || value === 'dark') {
    return value;
  }

  return null;
}

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [systemTheme, setSystemTheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  const resolvedThemeMode = themeMode === 'system' ? resolveSystemTheme(systemTheme) : themeMode;
  const isDarkMode = resolvedThemeMode === 'dark';

  const theme = useMemo(() => {
    return isDarkMode ? darkTheme : lightTheme;
  }, [isDarkMode]);

  const loadThemePreference = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
      if (!savedTheme) {
        setThemeModeState('system');
        return;
      }

      const parsed = JSON.parse(savedTheme);
      const savedThemeMode = parseThemeMode(parsed?.themeMode);
      if (savedThemeMode) {
        setThemeModeState(savedThemeMode);
        return;
      }

      if (typeof parsed?.isDarkMode === 'boolean') {
        setThemeModeState(parsed.isDarkMode ? 'dark' : 'light');
        return;
      }

      setThemeModeState('system');
    } catch (error) {
      console.error('Failed to load theme preference:', error);
      setThemeModeState('system');
    }
  }, []);

  const saveThemePreference = useCallback(async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(
        THEME_PREFERENCE_KEY,
        JSON.stringify({
          themeMode: mode,
          lastUpdated: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    saveThemePreference(mode);
  }, [saveThemePreference]);

  const toggleTheme = useCallback(() => {
    setThemeMode(isDarkMode ? 'light' : 'dark');
  }, [isDarkMode, setThemeMode]);

  const setTheme = useCallback((darkMode: boolean) => {
    setThemeMode(darkMode ? 'dark' : 'light');
  }, [setThemeMode]);

  useEffect(() => {
    loadThemePreference();
  }, [loadThemePreference]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  return useMemo(() => ({
    theme,
    themeMode,
    isDarkMode,
    systemTheme,
    toggleTheme,
    setTheme,
    setThemeMode,
  }), [theme, themeMode, isDarkMode, systemTheme, toggleTheme, setTheme, setThemeMode]);
});
