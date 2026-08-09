import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart, BarChart } from "react-native-chart-kit";
import { useTheme } from "../context/ThemeContext";

interface ChartData {
  labels: string[];
  datasets: { data: number[] }[];
}

interface ProgressChartProps {
  readonly title?: string;
  readonly icon?: string;
  readonly data: ChartData;
  readonly yAxisSuffix?: string;
  readonly chartWidth?: number;
  readonly chartColor?: string; // override the gradient/dot color
  readonly chartColorDark?: string; // override the darker shade (optional)
  readonly chartType?: "line" | "bar";
  /** Per-bar color override, only used when chartType is "bar". */
  readonly barColors?: string[];
  readonly showValuesOnTopOfBars?: boolean;
}

const { width } = Dimensions.get("window");

const makeChartConfig = (
  colors: any,
  chartColor: string,
  chartColorDark: string,
) => ({
  backgroundColor: chartColor,
  backgroundGradientFrom: chartColor,
  backgroundGradientTo: chartColorDark,
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: {
    r: "6",
    strokeWidth: "2",
    stroke: chartColorDark,
  },
});

export default function ProgressChart({
  title,
  icon,
  data,
  yAxisSuffix = "",
  chartWidth,
  chartColor,
  chartColorDark,
  chartType = "line",
  barColors,
  showValuesOnTopOfBars,
}: ProgressChartProps) {
  const { colors, resolvedChartColor, resolvedChartColorDark } = useTheme();
  // Explicit prop overrides > user setting > theme default
  const effectiveColor = chartColor ?? resolvedChartColor;
  const effectiveColorDark = chartColorDark ?? resolvedChartColorDark;
  const chartConfig = makeChartConfig(
    colors,
    effectiveColor,
    effectiveColorDark,
  );
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const barData = useMemo(() => {
    if (chartType !== "bar" || !barColors) return data;
    return {
      ...data,
      datasets: data.datasets.map((dataset) => ({
        ...dataset,
        colors: barColors.map((barColor) => () => barColor),
      })),
    };
  }, [chartType, barColors, data]);

  return (
    <View style={styles.chartSection}>
      {title && (
        <Text style={styles.chartTitle}>
          {icon ? `${icon} ` : ""}
          {title}
        </Text>
      )}
      {chartType === "bar" ? (
        <BarChart
          data={barData}
          width={chartWidth ?? width - 40}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
          yAxisLabel=""
          yAxisSuffix={yAxisSuffix}
          withInnerLines={false}
          fromZero
          withCustomBarColorFromData={!!barColors}
          flatColor={!!barColors}
          showValuesOnTopOfBars={showValuesOnTopOfBars}
        />
      ) : (
        <LineChart
          data={data}
          width={chartWidth ?? width - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          yAxisSuffix={yAxisSuffix}
          withInnerLines={false}
          withOuterLines
          withVerticalLines={false}
          withHorizontalLines
          fromZero
        />
      )}
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    chartSection: { marginBottom: 25 },
    chartTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 15,
    },
    chart: { marginVertical: 8, borderRadius: 16 },
  });
