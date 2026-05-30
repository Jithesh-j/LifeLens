import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { StyleProp, ViewStyle } from 'react-native';

const IOS_MAPPING: Record<string, string> = {
  'gym': 'dumbbell.fill',
  'rest': 'fork.knife',
  'walk': 'figure.walk',
  'run': 'figure.run',
  'swim': 'figure.pool.swim',
  'play': 'sportscourt.fill',
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: string;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  const nativeName = (IOS_MAPPING[name] || name) as SymbolViewProps['name'];
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={nativeName}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
