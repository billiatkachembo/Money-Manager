import React from 'react';
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from 'react-native';

const getNormalizedLength = (value: string) => value.replace(/\s+/g, '').trim().length;

export const getAdaptiveAmountFontSize = (
  value: string,
  baseFontSize: number,
  minimumFontSize = 12
): number => {
  const length = getNormalizedLength(value);

  if (length <= 10) return baseFontSize;
  if (length <= 14) return Math.max(minimumFontSize, baseFontSize - 1);
  if (length <= 18) return Math.max(minimumFontSize, baseFontSize - 2);
  if (length <= 22) return Math.max(minimumFontSize, baseFontSize - 4);
  if (length <= 28) return Math.max(minimumFontSize, baseFontSize - 6);

  return Math.max(minimumFontSize, baseFontSize - 8);
};

interface AdaptiveAmountTextProps extends Omit<TextProps, 'children'> {
  value: string;
  minFontSize?: number;
  style?: StyleProp<TextStyle>;
}

export const AdaptiveAmountText = React.memo(function AdaptiveAmountText({
  value,
  minFontSize = 12,
  minimumFontScale = 0.7,
  numberOfLines = 1,
  ellipsizeMode = 'clip',
  style,
  ...rest
}: AdaptiveAmountTextProps) {
  const flattenedStyle = StyleSheet.flatten(style) ?? {};
  const baseFontSize = typeof flattenedStyle.fontSize === 'number' ? flattenedStyle.fontSize : 16;
  const resolvedFontSize = getAdaptiveAmountFontSize(value, baseFontSize, minFontSize);

  return (
    <Text
      {...rest}
      adjustsFontSizeToFit
      ellipsizeMode={ellipsizeMode}
      minimumFontScale={minimumFontScale}
      numberOfLines={numberOfLines}
      style={[style, { fontSize: resolvedFontSize }]}
    >
      {value}
    </Text>
  );
});
