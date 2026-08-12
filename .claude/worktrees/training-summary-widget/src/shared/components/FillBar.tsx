import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export interface FillBarStyles {
  readonly track: StyleProp<ViewStyle>;
  readonly fill: StyleProp<ViewStyle>;
}

interface FillBarProps {
  readonly percentage: number;
  readonly color: string;
  readonly styles: FillBarStyles;
}

export function FillBar({ percentage, color, styles }: FillBarProps): React.JSX.Element {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: color }]} />
    </View>
  );
}

export default FillBar;
