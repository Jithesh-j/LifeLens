// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'person.fill': 'person',
  'person.crop.circle.fill': 'account-circle',
  'eyes': 'visibility',
  'exclamationmark.circle.fill': 'error',
  'plus.circle.fill': 'add-circle',
  'plus': 'add',
  'minus.circle.fill': 'remove-circle',
  'mic.fill': 'mic',
  'play.fill': 'play-arrow',
  'checkmark.circle.fill': 'check-circle',
  'clock.fill': 'access-time',
  'laptop': 'laptop-mac',
  'groups': 'people',
  'phone': 'phone',
  'gym': 'fitness-center',
  'rest': 'restaurant',
  'walk': 'directions-walk',
  'calendar': 'event',
  'lightbulb.fill': 'lightbulb',
  'brain.head.profile': 'psychology',
  'chart.line.uptrend.xyaxis': 'trending-up',
  'clock.arrow.circlepath': 'schedule',
  'sparkles': 'auto-awesome',
  'arrow.right': 'arrow-forward',
  'figure.walk': 'directions-walk',
  'moon.fill': 'nightlight-round',
  'sun.max.fill': 'wb-sunny',
  'bolt.fill': 'flash-on',
  'bell.fill': 'notifications',
  'link': 'link',
  'figure.pool.swim': 'pool',
  'figure.run': 'directions-run',
  'sportscourt.fill': 'sports-tennis',
  'xmark': 'close',
  'checkmark': 'check',
  'location.fill': 'location-on',
  'lock.fill': 'lock',
  'shield.fill': 'shield',
  'trash.fill': 'delete',
  'map.fill': 'map',
} as const;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
