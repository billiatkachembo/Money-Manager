import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/store/theme-store";
import AccountModalSkia from "@/components/charts/AccountModalSkia";

interface AccountModalData {
  months?: string[];
  income?: number[];
  expenses?: number[];
}

type Theme = ReturnType<typeof useTheme>['theme'];

interface AccountModalSkiaBoundaryProps {
  data?: AccountModalData;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class AccountModalSkiaErrorBoundary extends React.Component<React.PropsWithChildren<{ theme: Theme }>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Skia account modal failed to render", error);
  }

  render() {
    const { theme } = this.props;
    if (this.state.hasError) {
      return (
        <View style={[styles.fallback, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.fallbackTitle, { color: theme.colors.text }]}>Skia chart unavailable</Text>
          <Text style={[styles.fallbackText, { color: theme.colors.textSecondary }]}>The Skia chart could not render on this build yet.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export function AccountModalSkiaBoundary({ data }: AccountModalSkiaBoundaryProps) {
  const { theme } = useTheme();

  return (
    <AccountModalSkiaErrorBoundary theme={theme}>
      <AccountModalSkia data={data} />
    </AccountModalSkiaErrorBoundary>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  fallbackText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },
});



