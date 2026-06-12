import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { StyleProp, ViewStyle } from 'react-native';

const IOS_MAPPING: Record<string, string> = {
  'gym': 'dumbbell.fill',
  'rest': 'fork.knife',
  'walk': 'figure.walk',
  'run': 'figure.run',
  'swim': 'figure.pool.swim',
  'play': 'sportscourt.fill',
  'cup.and.saucer': 'cup.and.saucer.fill',
};

// A list of all known valid SF Symbols that are supported in our app
const VALID_SF_SYMBOLS = new Set([
  'house.fill',
  'paperplane.fill',
  'chevron.left.forwardslash.chevron.right',
  'chevron.right',
  'person.fill',
  'person.crop.circle.fill',
  'eyes',
  'exclamationmark.circle.fill',
  'plus.circle.fill',
  'plus',
  'minus.circle.fill',
  'mic.fill',
  'play.fill',
  'checkmark.circle.fill',
  'clock.fill',
  'laptop',
  'groups',
  'phone',
  'gym',
  'rest',
  'walk',
  'calendar',
  'lightbulb.fill',
  'brain.head.profile',
  'chart.line.uptrend.xyaxis',
  'clock.arrow.circlepath',
  'sparkles',
  'arrow.right',
  'figure.walk',
  'moon.fill',
  'sun.max.fill',
  'bolt.fill',
  'bell.fill',
  'link',
  'figure.pool.swim',
  'figure.run',
  'sportscourt.fill',
  'run',
  'swim',
  'play',
  'xmark',
  'checkmark',
  'location.fill',
  'lock.fill',
  'shield.fill',
  'trash.fill',
  'map.fill',
  'envelope.fill',
  'eye.fill',
  'eye.slash.fill',
  'person.3.fill',
  'person.3',
  'person.2.fill',
  'person.2',
  'person.2.circle.fill',
  'person.2.circle',
  'person.group.fill',
  'person.group',
  'social',
  'people.fill',
  'people',
  // grocery/shopping symbols
  'cart',
  'cart.fill',
  'cart.badge.plus',
  'bag',
  'bag.fill',
  'basket',
  'basket.fill',
  // checklists / docs symbols
  'checklist',
  'checkmark.circle',
  'doc.text',
  'list.bullet',
  'book',
  'book.fill',
  'cup.and.saucer',
  'cup.and.saucer.fill',
  'dumbbell.fill',
  'fork.knife',
]);

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
  // 1. Resolve direct iOS mapping
  let nativeName = IOS_MAPPING[name] || name;

  // 2. Validate if the resolved nativeName is a valid SF Symbol in our set. 
  // If not, fallback to 'sparkles' to ensure a premium asset is always displayed!
  if (!VALID_SF_SYMBOLS.has(nativeName)) {
    nativeName = 'sparkles';
  }

  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={nativeName as SymbolViewProps['name']}
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
