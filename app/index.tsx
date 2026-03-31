import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NativeSplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const SPLASH_BACKGROUND = '#667eea';
const LOGO_SOURCE = require('../assets/images/splash-logo-white.png');
const LOGO_HOLD_MS = 320;
const LOGO_PULSE_MS = 320;
const LOGO_SETTLE_MS = 320;
const NAVIGATE_MS = 1800;

export default function SplashScreen() {
  const router = useRouter();
  const scale = useSharedValue(1);

  useEffect(() => {
    const splashFrame = requestAnimationFrame(() => {
      void NativeSplashScreen.hideAsync();
    });

    scale.value = withDelay(
      LOGO_HOLD_MS,
      withSequence(
        withTiming(1.045, {
          duration: LOGO_PULSE_MS,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1, {
          duration: LOGO_SETTLE_MS,
          easing: Easing.out(Easing.quad),
        })
      )
    );

    const timeout = setTimeout(() => {
      router.replace('/(tabs)/home');
    }, NAVIGATE_MS);

    return () => {
      clearTimeout(timeout);
      cancelAnimation(scale);
      cancelAnimationFrame(splashFrame);
    };
  }, [router, scale]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'none', gestureEnabled: false }} />
      <StatusBar style="light" />
      <View style={[styles.container, { backgroundColor: SPLASH_BACKGROUND }]}>
        <Animated.View style={logoAnimatedStyle}>
          <Image source={LOGO_SOURCE} resizeMode="contain" style={styles.logo} />
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 104,
    height: 104,
  },
});
