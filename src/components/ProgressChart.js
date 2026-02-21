// components/ProgressChart.jsx
import React from "react"
import { View, Text, StyleSheet, Dimensions } from "react-native"
import { LineChart } from "react-native-chart-kit"

const { width } = Dimensions.get("window")

const chartConfig = {
  backgroundColor: "#667eea",
  backgroundGradientFrom: "#667eea",
  backgroundGradientTo: "#764ba2",
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: "6",
    strokeWidth: "2",
    stroke: "#764ba2",
  },
}

export default function ProgressChart({
  title,
  icon,
  data,
  yAxisSuffix = "",
  chartWidth,
}) {
  return (
    <View style={styles.chartSection}>
      <Text style={styles.chartTitle}>
        {icon} {title}
      </Text>
      <LineChart
        data={data}
        width={chartWidth || width - 40}
        height={220}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        yAxisSuffix={yAxisSuffix}
        withInnerLines={false}
        withOuterLines={true}
        withVerticalLines={false}
        withHorizontalLines={true}
        fromZero={true}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  chartSection: {
    marginBottom: 25,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
})
