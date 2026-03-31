import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, Dimensions, ScrollView } from "react-native";
import {
  Canvas,
  Path,
  Skia,
  Rect,
  Group,
  useValue,
  runSpring,
} from "@shopify/react-native-skia";
import { PanGestureHandler } from "react-native-gesture-handler";

const { width } = Dimensions.get("window");
const CHART_W = width;
const LINE_H = 220;
const BAR_H = 180;
const PIE_H = 220;

interface AccountModalData {
  months?: string[];
  income?: number[];
  expenses?: number[];
}

interface AccountModalSkiaProps {
  data?: AccountModalData;
}

export default function AccountModalSkia({ data }: AccountModalSkiaProps) {
  const months = data?.months || [];
  const income = data?.income || [];
  const expenses = data?.expenses || [];

  const maxVal = Math.max(...income, ...expenses, 1);
  const colors = ["#FF6B6B", "#FFA94D", "#FFD43B", "#94D82D", "#69DB7C", "#4A90E2"];

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // -------- Animations --------
  const pieAngles = useMemo(() => expenses.map(() => useValue(0)), [expenses.length]);
  const pieRotation = useValue(0);
  const linePoints = useMemo(() => income.map((v) => useValue((v / maxVal) * LINE_H)), [income, maxVal]);

  useEffect(() => {
    const totalExpense = expenses.reduce((a, b) => a + b, 0);

    expenses.forEach((v, i) => {
      const targetAngle =
        selectedMonth === i ? 360 : selectedMonth == null && totalExpense > 0 ? (v / totalExpense) * 360 : 0;
      runSpring(pieAngles[i], targetAngle, { damping: 12, stiffness: 120 });
    });

    const rotationTarget =
      selectedMonth != null && totalExpense > 0
        ? -((expenses.slice(0, selectedMonth).reduce((a, b) => a + b, 0) / totalExpense) * 360)
        : 0;
    runSpring(pieRotation, rotationTarget, { damping: 12, stiffness: 120 });

    income.forEach((v, i) => {
      const targetY = LINE_H - (v / maxVal) * LINE_H;
      runSpring(linePoints[i], targetY, { damping: 12, stiffness: 120 });
    });
  }, [selectedMonth, expenses, income, linePoints, maxVal, pieAngles, pieRotation]);

  const deg2rad = (deg: number) => (deg * Math.PI) / 180;
  const barWidth = months.length > 0 ? CHART_W / (months.length * 2) : 0;
  const totalExpense = expenses.reduce((a, b) => a + b, 0);

  // -------- Animated line chart --------
  const linePath = useMemo(() => {
    const p = Skia.Path.Make();
    if (!linePoints || linePoints.length === 0) return p;

    const getPoint = (i: number) => ({
      x: (i / (linePoints.length - 1 || 1)) * CHART_W,
      y: linePoints[i].current,
    });

    linePoints.forEach((_, i) => {
      const { x, y } = getPoint(i);
      if (i === 0) p.moveTo(x, y);
      else {
        const prev = getPoint(i - 1);
        const midX = (prev.x + x) / 2;
        p.cubicTo(midX, prev.y, midX, y, x, y);
      }
    });
    return p;
  }, [linePoints]);

  const handleGesture = (nativeEvent: { translationX: number }) => {
    if (nativeEvent.translationX < -50)
      setSelectedMonth((prev) => Math.min((prev ?? 0) + 1, months.length - 1));
    if (nativeEvent.translationX > 50)
      setSelectedMonth((prev) => Math.max((prev ?? 0) - 1, 0));
  };

  // -------- Dynamic title --------
  const titleText = selectedMonth != null ? months[selectedMonth] : "All Months";

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{titleText}</Text>

      {/* ?? LINE CHART */}
      <Canvas style={{ width: CHART_W, height: LINE_H }}>
        <Path path={linePath} color="red" style="stroke" strokeWidth={3} />
      </Canvas>

      {/* ?? BAR CHART */}
      <PanGestureHandler onGestureEvent={({ nativeEvent }) => handleGesture(nativeEvent)}>
        <Canvas style={{ width: CHART_W, height: BAR_H }}>
          <Group>
            {months.map((_, i) => {
              const x = i * barWidth * 2;
              const h1 = (income[i] / maxVal) * BAR_H;
              const h2 = (expenses[i] / maxVal) * BAR_H;
              const isSelected = selectedMonth === i;
              return (
                <Group key={i}>
                  <Rect
                    x={x}
                    y={BAR_H - h1}
                    width={barWidth}
                    height={h1}
                    color={isSelected ? "#4AC9FF" : "#4A90E2"}
                    onPress={() => setSelectedMonth(i)}
                  />
                  <Rect
                    x={x + barWidth}
                    y={BAR_H - h2}
                    width={barWidth}
                    height={h2}
                    color={isSelected ? "#FF4B4B" : "#FF6B6B"}
                    onPress={() => setSelectedMonth(i)}
                  />
                </Group>
              );
            })}
          </Group>
        </Canvas>
      </PanGestureHandler>

      {/* ?? PIE CHART */}
      <Canvas style={{ width: CHART_W, height: PIE_H }}>
        <Group origin={{ x: CHART_W / 2, y: PIE_H / 2 }} transform={[{ rotate: deg2rad(pieRotation.current) }]}>
          {expenses.map((_, i) => {
            const radius = selectedMonth === i ? 90 : 80;
            const cx = CHART_W / 2;
            const cy = PIE_H / 2;

            const path = Skia.Path.Make();
            path.moveTo(cx, cy);
            const sliceAngle = pieAngles[i].current;
            path.arcTo(
              cx - radius,
              cy - radius,
              cx + radius,
              cy + radius,
              deg2rad(0),
              deg2rad(sliceAngle),
              false
            );
            path.close();

            return <Path key={i} path={path} color={colors[i % colors.length]} />;
          })}
        </Group>
      </Canvas>

      {/* Legend */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
        {expenses.map((v, i) => {
          const percent = totalExpense > 0 ? ((v / totalExpense) * 100).toFixed(1) : "0.0";
          const isSelected = selectedMonth === i;
          return (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", marginRight: 15, marginBottom: 5 }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: colors[i % colors.length],
                  borderRadius: 6,
                  marginRight: 5,
                  transform: [{ scale: isSelected ? 1.3 : 1 }],
                }}
              />
              <Text style={{ color: "#fff", fontWeight: isSelected ? "bold" : "normal" }}>
                {months[i]} ({percent}%)
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 10,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 10,
  },
});
