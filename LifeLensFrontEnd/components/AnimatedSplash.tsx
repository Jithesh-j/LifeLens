import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const { width: SW, height: SH } = Dimensions.get('window');
const CX = SW / 2;
const CY = SH * 0.35;
const ORBIT_R = Math.min(SW * 0.22, 95);

const OBSIDIAN = '#03040B';
const NEON_PURPLE = '#A855F7';
const SKY_BLUE = '#0EA5E9';
const SUNSET_ORANGE = '#F97316';
const EMERALD_GREEN = '#10B981';
const ROSE_PINK = '#EC4899';

const ICONS: { name: any; color: string; bg: string }[] = [
  { name: 'weather-sunset',        color: EMERALD_GREEN, bg: 'rgba(16,185,129,0.18)' },
  { name: 'coffee',                color: SUNSET_ORANGE, bg: 'rgba(249,115,22,0.18)' },
  { name: 'walk',                  color: SKY_BLUE,      bg: 'rgba(14,165,233,0.18)' },
  { name: 'shopping',              color: ROSE_PINK,     bg: 'rgba(236,72,153,0.18)' },
  { name: 'silverware-fork-knife', color: NEON_PURPLE,   bg: 'rgba(168,85,247,0.18)' },
];

interface Props { onFinish: () => void; }

export default function AnimatedSplash({ onFinish }: Props) {
  const masterFade   = useRef(new Animated.Value(1)).current;
  const iconOps      = useRef(ICONS.map(() => new Animated.Value(0))).current;
  const iconScales   = useRef(ICONS.map(() => new Animated.Value(0))).current;
  const titleOp      = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(18)).current;
  const subtitleOp   = useRef(new Animated.Value(0)).current;
  const subtitleY    = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      // Icons pop in rapid-fire
      Animated.stagger(90, ICONS.map((_, i) =>
        Animated.parallel([
          Animated.timing(iconOps[i],    { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(iconScales[i], { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
        ])
      )),

      Animated.delay(150),

      // Title "Life Lens" slides up + fades in
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(titleY,  { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),

      // Subtitle "your life, your way." slides up + fades in
      Animated.parallel([
        Animated.timing(subtitleOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(subtitleY,  { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),

      // Brief hold
      Animated.delay(700),

      // Fade out
      Animated.timing(masterFade, { toValue: 0, duration: 350, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: masterFade }]} pointerEvents="none">
      <StatusBar barStyle="light-content" />

      {/* 5 category icons in a circle */}
      {ICONS.map((ic, idx) => {
        const angle = (-90 + idx * 72) * (Math.PI / 180);
        const px = CX + ORBIT_R * Math.cos(angle) - 24;
        const py = CY + ORBIT_R * Math.sin(angle) - 24;
        return (
          <Animated.View key={idx} style={[styles.iconWrap, { left: px, top: py, opacity: iconOps[idx], transform: [{ scale: iconScales[idx] }] }]}>
            <View style={[styles.iconBubble, { backgroundColor: ic.bg, borderColor: ic.color, shadowColor: ic.color }]}>
              <MaterialCommunityIcons name={ic.name} size={22} color={ic.color} />
            </View>
          </Animated.View>
        );
      })}

      {/* Title text */}
      <Animated.View style={[styles.textBlock, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>  
        <Text style={styles.title}>Life Lens</Text>
      </Animated.View>

      {/* Subtitle text */}
      <Animated.View style={[styles.subtitleBlock, { opacity: subtitleOp, transform: [{ translateY: subtitleY }] }]}>  
        <Text style={styles.subtitle}>your life, your way.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: OBSIDIAN, zIndex: 9999 },
  iconWrap: { position: 'absolute', width: 48, height: 48 },
  iconBubble: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 6 },
  textBlock: { position: 'absolute', top: CY + ORBIT_R + 50, width: SW, alignItems: 'center' },
  title: { fontSize: 34, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1.5 },
  subtitleBlock: { position: 'absolute', top: CY + ORBIT_R + 94, width: SW, alignItems: 'center' },
  subtitle: { fontSize: 16, fontWeight: '400', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8 },
});
