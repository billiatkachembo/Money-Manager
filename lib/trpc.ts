import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import Constants from "expo-constants";
import { Platform } from "react-native";

export const trpc = createTRPCReact<AppRouter>();

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function getDevFallbackBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  const devHost = hostUri?.split(":")[0];

  if (devHost) {
    return `http://${devHost}:3000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  return "http://127.0.0.1:3000";
}

const getBaseUrl = () => {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  const fallbackBaseUrl = getDevFallbackBaseUrl();
  console.warn(
    `[tRPC] EXPO_PUBLIC_RORK_API_BASE_URL is not set. Falling back to ${fallbackBaseUrl}`
  );
  return fallbackBaseUrl;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});
