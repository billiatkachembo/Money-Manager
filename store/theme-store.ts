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

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [systemTheme, setSystemTheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  const theme = useMemo(() => {
    return isDarkMode ? darkTheme : lightTheme;
  }, [isDarkMode]);

  const loadThemePreference = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme_preference');
      if (savedTheme) {
        const parsed = JSON.parse(savedTheme);
        setIsDarkMode(parsed.isDarkMode);
      } else {
        // Use system theme as default
        setIsDarkMode(systemTheme === 'dark');
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
      setIsDarkMode(systemTheme === 'dark');
    }
  }, [systemTheme]);

  const saveThemePreference = useCallback(async (darkMode: boolean) => {
    try {
      await AsyncStorage.setItem('theme_preference', JSON.stringify({
        isDarkMode: darkMode,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    saveThemePreference(newDarkMode);
  }, [isDarkMode, saveThemePreference]);

  const setTheme = useCallback((darkMode: boolean) => {
    setIsDarkMode(darkMode);
    saveThemePreference(darkMode);
  }, [saveThemePreference]);

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
    isDarkMode,
    systemTheme,
    toggleTheme,
    setTheme,
  }), [theme, isDarkMode, systemTheme, toggleTheme, setTheme]);
});