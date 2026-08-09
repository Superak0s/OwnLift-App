import React from "react";
import { View, Text, TouchableOpacity, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

export interface IntensityPickerStyles {
  readonly container: StyleProp<ViewStyle>;
  readonly button: StyleProp<ViewStyle>;
  readonly buttonText: StyleProp<TextStyle>;
}

interface IntensityPickerProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly getColor: (value: number) => string;
  readonly unselectedBackground: string;
  readonly unselectedBorder?: string;
  readonly unselectedTextColor: string;
  readonly max?: number;
  readonly styles: IntensityPickerStyles;
}

export function IntensityPicker({
  value,
  onChange,
  getColor,
  unselectedBackground,
  unselectedBorder,
  unselectedTextColor,
  max = 10,
  styles,
}: IntensityPickerProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {Array.from({ length: max + 1 }, (_, level) => level).map((level) => {
        const selected = value === level;
        const color = getColor(level);
        return (
          <TouchableOpacity
            key={level}
            style={[
              styles.button,
              {
                backgroundColor: selected ? color : unselectedBackground,
                borderColor: selected ? color : (unselectedBorder ?? unselectedBackground),
              },
            ]}
            onPress={() => onChange(level)}
          >
            <Text style={[styles.buttonText, { color: selected ? "white" : unselectedTextColor }]}>
              {level}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default IntensityPicker;
