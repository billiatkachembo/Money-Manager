import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { DollarSign, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/store/theme-store';
import { AppBottomSheet, AppBottomSheetAction } from '@/components/ui/AppBottomSheet';
import { useI18n } from '@/src/i18n';

interface AmountCalculatorSheetProps {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: (value: string) => void;
  onCurrencyPress?: () => void;
}

const OPERATORS = ['+', '-', '*', '/'] as const;


const normalizeKey = (value: string) => {
  if (value === 'x') return '*';
  return value;
};

const isOperator = (value: string) => OPERATORS.includes(value as (typeof OPERATORS)[number]);

const toCalculatorDisplay = (value: number): string => {
  const normalized = Math.round((value + Number.EPSILON) * 100) / 100;
  return normalized.toString();
};

const evaluateExpression = (expression: string): number => {
  const source = expression.replace(/\s+/g, '');
  if (!source) {
    throw new Error('Empty expression');
  }

  if (!/^[0-9+\-*/.()]+$/.test(source)) {
    throw new Error('Invalid expression');
  }

  let cursor = 0;

  const parseExpression = (): number => {
    let value = parseTerm();

    while (cursor < source.length && (source[cursor] === '+' || source[cursor] === '-')) {
      const operator = source[cursor];
      cursor += 1;
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }

    return value;
  };

  const parseTerm = (): number => {
    let value = parseFactor();

    while (cursor < source.length && (source[cursor] === '*' || source[cursor] === '/')) {
      const operator = source[cursor];
      cursor += 1;
      const right = parseFactor();

      if (operator === '/' && right === 0) {
        throw new Error('Division by zero');
      }

      value = operator === '*' ? value * right : value / right;
    }

    return value;
  };

  const parseFactor = (): number => {
    if (source[cursor] === '+' || source[cursor] === '-') {
      const sign = source[cursor] === '-' ? -1 : 1;
      cursor += 1;
      return sign * parseFactor();
    }

    if (source[cursor] === '(') {
      cursor += 1;
      const value = parseExpression();
      if (source[cursor] !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      cursor += 1;
      return value;
    }

    const start = cursor;
    let dotCount = 0;

    while (cursor < source.length && /[0-9.]/.test(source[cursor])) {
      if (source[cursor] === '.') {
        dotCount += 1;
      }
      cursor += 1;
    }

    if (start === cursor || dotCount > 1) {
      throw new Error('Invalid number');
    }

    const value = Number(source.slice(start, cursor));
    if (!Number.isFinite(value)) {
      throw new Error('Invalid number');
    }

    return value;
  };

  const result = parseExpression();
  if (cursor !== source.length || !Number.isFinite(result)) {
    throw new Error('Invalid expression');
  }

  return Math.round((result + Number.EPSILON) * 100) / 100;
};

export function AmountCalculatorSheet({
  visible,
  value,
  onChange,
  onClose,
  onConfirm,
  onCurrencyPress,
}: AmountCalculatorSheetProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [expression, setExpression] = useState(value || '0');

  useEffect(() => {
    if (visible) {
      setExpression(value && value.trim() ? value : '0');
    }
  }, [value, visible]);

  const updateExpression = useCallback(
    (nextValue: string) => {
      setExpression(nextValue);
      onChange(nextValue);
    },
    [onChange]
  );

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleKeyPress = useCallback(
    (rawValue: string) => {
      triggerHaptic();

      if (rawValue === 'C') {
        updateExpression('0');
        return;
      }

      if (rawValue === 'DEL') {
        const nextValue = expression.length <= 1 ? '0' : expression.slice(0, -1);
        updateExpression(nextValue);
        return;
      }

      if (rawValue === 'Done') {
        let resolved = expression;
        try {
          resolved = toCalculatorDisplay(evaluateExpression(expression));
        } catch {
          const numeric = expression.replace(/[^0-9.]/g, '');
          resolved = numeric || '0';
        }
        onConfirm(resolved);
        return;
      }

      const valueKey = normalizeKey(rawValue);

      if (valueKey === '.') {
        const activeChunk = (expression.split(/[+\-*/]/).pop() ?? '');
        if (activeChunk.includes('.')) {
          return;
        }
        const nextValue = expression === '0' ? '0.' : expression + '.';
        updateExpression(nextValue);
        return;
      }

      if (isOperator(valueKey)) {
        if (expression === '0' && valueKey !== '-') {
          return;
        }
        const nextValue = isOperator(expression.slice(-1))
          ? expression.slice(0, -1) + valueKey
          : expression + valueKey;
        updateExpression(nextValue);
        return;
      }

      const nextValue = expression === '0' ? valueKey : expression + valueKey;
      updateExpression(nextValue);
    },
    [expression, onClose, onConfirm, triggerHaptic, updateExpression]
  );

  const actions = useMemo<AppBottomSheetAction[]>(
    () => [
      {
        icon: DollarSign,
        onPress: () => onCurrencyPress?.(),
        accessibilityLabel: t('amountCalculator.accessibility.currency'),
      },
      {
        icon: Trash2,
        onPress: () => handleKeyPress('DEL'),
        accessibilityLabel: t('amountCalculator.accessibility.delete'),
      },
    ],
    [handleKeyPress, onCurrencyPress, t]
  );


  const keypadRows = [
    ['1', '2', '3', 'DEL'],
    ['4', '5', '6', '-'],
    ['7', '8', '9', '+'],
    ['', '0', '.', 'Done'],
  ];

  return (
    <AppBottomSheet
      visible={visible}
      title={t('amountCalculator.title')}
      snapPoints={['48%', '62%']}
      initialSnapIndex={0}
      actions={actions}
      onClose={onClose}
    >

      <View style={styles.keypad}>
        {keypadRows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.keypadRow}>
            {row.map((key, keyIndex) => {
              if (!key) {
                return <View key={`spacer-${keyIndex}`} style={[styles.key, styles.keySpacer]} />;
              }

              const isDone = key === 'Done';
              const isDelete = key === 'DEL';
              const isOperatorKey = ['-', '+'].includes(key);
              const label = isDelete ? 'DEL' : key === 'Done' ? t('common.done') : key;

              return (
                <Pressable
                  key={`key-${keyIndex}-${key}`}
                  onPress={() => handleKeyPress(key)}
                  style={({ pressed }) => [
                    styles.key,
                    {
                      backgroundColor: isDone
                        ? theme.colors.primary
                        : theme.colors.surface,
                      borderColor: isOperatorKey ? theme.colors.primary : theme.colors.border,
                    },
                    isDone && styles.doneKey,
                    pressed && styles.keyPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.keyText,
                      { color: isDone ? 'white' : theme.colors.text },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({

  keypad: {
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 12,
  },
  key: {
    flex: 1,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  keyPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.8,
  },
  keySpacer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  keyText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  doneKey: {
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
