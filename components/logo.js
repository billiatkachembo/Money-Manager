import React, { useEffect } from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function Logo({ size = 200, animate = true }) {
  const dashOffset = useSharedValue(2000);
  const glowOpacity = useSharedValue(0.15);

  useEffect(() => {
    if (!animate) {
      dashOffset.value = 0;
      glowOpacity.value = 0.15;
      return;
    }

    dashOffset.value = withTiming(0, { duration: 700 });
    glowOpacity.value = withSequence(
      withDelay(300, withTiming(0.3, { duration: 200 })),
      withTiming(0.15, { duration: 200 })
    );
  }, [animate, dashOffset, glowOpacity]);

  const animatedStroke = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const animatedGlow = useAnimatedProps(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024">
          <Stop offset="0%" stopColor="#667eea" />
          <Stop offset="100%" stopColor="#764ba2" />
        </LinearGradient>
      </Defs>

      <Rect width="1024" height="1024" rx="220" fill="url(#bg)" />

      <AnimatedPath
        animatedProps={animatedGlow}
        d="M220 650 L350 420 L480 650 L610 420 L740 650 L870 300"
        stroke="white"
        strokeWidth="90"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <AnimatedPath
        animatedProps={animatedStroke}
        d="M220 650 L350 420 L480 650 L610 420 L740 650 L870 300"
        stroke="white"
        strokeWidth="60"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2000 2000"
      />
    </Svg>
  );
}
