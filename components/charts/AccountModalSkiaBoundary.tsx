import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AccountModalSkia from "@/components/charts/AccountModalSkia";

interface AccountModalData {
  months?: string[];
  income?: number[];
  expenses?: number[];
}

interface AccountModalSkiaBoundaryProps {
  data?: AccountModalData;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class AccountModalSkiaErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Skia account modal failed to render", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>Skia chart unavailable</Text>
          <Text style={styles.fallbackText}>The Skia chart could not render on this build yet.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export function AccountModalSkiaBoundary({ data }: AccountModalSkiaBoundaryProps) {
  return (
    <AccountModalSkiaErrorBoundary>
      <AccountModalSkia data={data} />
    </AccountModalSkiaErrorBoundary>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  fallbackTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  fallbackText: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },
});
