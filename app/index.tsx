import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NativeSplashScreen from 'expo-splash-screen';
import { LinearGradient as RNGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import Logo from '../components/logo';

NativeSplashScreen.preventAutoHideAsync();

const LOGO_HOLD_MS = 200;
const NAVIGATE_MS = 1700;

export default function SplashScreen() {
  const router = useRouter();

  // Reanimated
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    requestAnimationFrame(() => {
      NativeSplashScreen.hideAsync();
    });

    // Fade + slide
    opacity.value = withTiming(1, { duration: 500 });

    translateY.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });

    // Pulse
    scale.value = withDelay(
      LOGO_HOLD_MS,
      withSequence(
        withTiming(1.08, { duration: 370 }),
        withTiming(0.98, { duration: 360 }),
        withTiming(1, { duration: 3600 })
      )
    );


    // 📳 Haptic on finish
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 1600);

    // Navigate
    const timeout = setTimeout(() => {
      router.replace('/(tabs)/home');
    }, NAVIGATE_MS);

    return () => {
      clearTimeout(timeout);
      cancelAnimation(scale);
      cancelAnimation(opacity);
      cancelAnimation(translateY);
    };
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <RNGradient
        colors={['#667eea', '#764ba2']}
        style={styles.container}
      >
        <View style={styles.brandLockup}>
          <Animated.View style={logoStyle}>
            <Logo size={200} />
          </Animated.View>
        </View>
      </RNGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLockup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});