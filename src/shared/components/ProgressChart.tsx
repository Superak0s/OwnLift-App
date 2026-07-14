import React from "react"
import { View, Text, StyleSheet, Dimensions } from "react-native"
import { LineChart } from "react-native-chart-kit"
import type { ChartData } from "react-native-chart-kit/dist/HelperTypes"
import { useTheme } from "../context/ThemeContext"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressChartProps {
  title: string
  icon: string
  data: ChartData
  yAxisSuffix?: string
  chartWidth?: number
  chartColor?: string // override the gradient/dot color
  chartColorDark?: string // override the darker shade (optional)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { width } = Dimensions.get("window")

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
})

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgressChart({
  title,
  icon,
  data,
  yAxisSuffix = "",
  chartWidth,
  chartColor,
  chartColorDark,
}: ProgressChartProps) {
  const { colors, resolvedChartColor, resolvedChartColorDark } = useTheme()
  // Explicit prop overrides > user setting > theme default
  const effectiveColor = chartColor ?? resolvedChartColor
  const effectiveColorDark = chartColorDark ?? resolvedChartColorDark
  const chartConfig = makeChartConfig(
    colors,
    effectiveColor,
    effectiveColorDark,
  )
  const styles = makeStyles(colors)
  return (
    <View style={styles.chartSection}>
      <Text style={styles.chartTitle}>
        {icon} {title}
      </Text>
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
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  })
