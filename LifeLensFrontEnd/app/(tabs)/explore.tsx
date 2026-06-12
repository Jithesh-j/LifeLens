import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { Fonts } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── COLOR SYSTEM ─────────────────────────────────────────────────────────────
const OBSIDIAN = '#03040B';
const NEON_PURPLE = '#0D9488'; // Brand Teal
const SKY_BLUE = '#0EA5E9';
const SUNSET_ORANGE = '#F97316';
const EMERALD_GREEN = '#10B981';
const ROSE_PINK = '#EC4899';
const BORDER_WHITE = 'rgba(255, 255, 255, 0.08)';
const GLASS_BG = 'rgba(15, 17, 35, 0.7)';

// ── ORBIT PARAMETERS ─────────────────────────────────────────────────────────
const ORBIT_RADIUS = 110;
const ICON_COUNT = 5;

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
}

interface Particle {
  id: number;
  angle: number;
  color: string;
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [activeMoodText, setActiveMoodText] = useState('Cosmic Core Idle');
  const [activeMoodDesc, setActiveMoodDesc] = useState('Tap any lifestyle icon to enrich your current timeline focus.');
  const [selectedIconIndex, setSelectedIconIndex] = useState<number | null>(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);

  // ── ANIMATION VALUES ────────────────────────────────────────────────────────
  const startupAnim = useRef(new Animated.Value(0)).current; // Global transition controller (0 to 1)
  const pulseCoreScale = useRef(new Animated.Value(1)).current;
  const pulseCoreOpacity = useRef(new Animated.Value(0.4)).current;
  
  // Rotating Rings
  const ring1Rotation = useRef(new Animated.Value(0)).current;
  const ring2Rotation = useRef(new Animated.Value(0)).current;
  
  // Center Ripple Wave
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  
  // Energy Arcs
  const arcOpacity = useRef(new Animated.Value(0)).current;
  const arcRotation = useRef(new Animated.Value(0)).current;
  const [activeArcIcon, setActiveArcIcon] = useState<number>(0);

  // 5 Lifestyle Icons Animations
  const iconOpacities = useRef([
    new Animated.Value(0), // Nature
    new Animated.Value(0), // Coffee
    new Animated.Value(0), // Walk
    new Animated.Value(0), // Shopping
    new Animated.Value(0), // Food
  ]).current;

  const iconScales = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const iconTranslateYs = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Float Animations for floating naturally in orbit
  const iconFloatOffsets = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Custom icon special effects values
  const steamTranslate = useRef(new Animated.Value(0)).current;
  const steamOpacity = useRef(new Animated.Value(0)).current;
  const trailOpacity = useRef(new Animated.Value(0)).current;
  const sparkleScale = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;

  // Drifting Star Dust / Particles
  const particlesScale = useRef(new Animated.Value(0.2)).current;
  const particlesOpacity = useRef(new Animated.Value(0)).current;

  // Twinkling stars database
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    // Generate stars
    const newStars: Star[] = Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * (SCREEN_HEIGHT * 0.7),
      size: Math.random() * 2 + 1,
      delay: Math.random() * 4000,
    }));
    setStars(newStars);

    // Initial ambient core loop
    startAmbientCore();
    startRingRotations();

    // Trigger full opening startup sequence automatically on load
    runStartupSequence();
  }, []);

  // ── CORE STARTUP SEQUENCE ──────────────────────────────────────────────────
  const runStartupSequence = () => {
    if (isPlayingSequence) return;
    setIsPlayingSequence(true);
    setActiveMoodText('Calibrating Core...');
    setActiveMoodDesc('Connecting neon rings, matching ambient gravity fields, and aligning timelines.');
    setSelectedIconIndex(null);

    // 1. Reset all states
    startupAnim.setValue(0);
    rippleScale.setValue(0);
    rippleOpacity.setValue(0);
    particlesScale.setValue(0.2);
    particlesOpacity.setValue(0);
    steamTranslate.setValue(0);
    steamOpacity.setValue(0);
    trailOpacity.setValue(0);
    sparkleScale.setValue(0);
    sparkleOpacity.setValue(0);
    
    iconOpacities.forEach((opacity) => opacity.setValue(0));
    iconScales.forEach((scale) => scale.setValue(0));
    iconTranslateYs.forEach((ty) => ty.setValue(0));
    iconTranslateYs[2].setValue(25); // Set slide-up starting offset for walking figure

    // 2. Play sequential magical reveal
    Animated.sequence([
      // First, complete darkness to faint heartbeat pulse in center
      Animated.timing(startupAnim, {
        toValue: 0.3,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
      
      // Neon rings materialize with particles
      Animated.parallel([
        Animated.timing(startupAnim, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(particlesOpacity, {
          toValue: 0.8,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(particlesScale, {
          toValue: 1.2,
          duration: 2500,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]),

      // Lifestyle icons reveal one by one in orbit
      Animated.delay(300),
      
      // Icon 0: Windmill (Nature) bloom with sparkle burst
      Animated.parallel([
        Animated.timing(iconOpacities[0], { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(iconScales[0], { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.sequence([
          Animated.parallel([
            Animated.timing(sparkleScale, { toValue: 1.4, duration: 400, useNativeDriver: true }),
            Animated.timing(sparkleOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          ]),
          Animated.timing(sparkleOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]),
      
      Animated.delay(400),

      // Icon 1: Coffee Mug with steam wave
      Animated.parallel([
        Animated.timing(iconOpacities[1], { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(iconScales[1], { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(steamTranslate, { toValue: -8, duration: 1000, useNativeDriver: true }),
              Animated.timing(steamOpacity, { toValue: 0.7, duration: 400, useNativeDriver: true }),
            ]),
            Animated.timing(steamOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
          { iterations: -1 }
        ),
      ]),

      Animated.delay(400),

      // Icon 2: Walking Figure slides upward with trail
      Animated.parallel([
        Animated.timing(iconOpacities[2], { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(iconScales[2], { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(iconTranslateYs[2], { toValue: 0, friction: 5, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(trailOpacity, { toValue: 0.6, duration: 200, useNativeDriver: true }),
            Animated.timing(trailOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ]),
      ]),

      Animated.delay(400),

      // Icon 3: Shopping Bag with elastic bounce
      Animated.parallel([
        Animated.timing(iconOpacities[3], { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(iconScales[3], { toValue: 1.2, friction: 3, tension: 40, useNativeDriver: true }),
      ]),
      Animated.spring(iconScales[3], { toValue: 1, friction: 5, useNativeDriver: true }),

      Animated.delay(400),

      // Icon 4: Food draws itself / fades in sketch
      Animated.parallel([
        Animated.timing(iconOpacities[4], { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(iconScales[4], { toValue: 1, friction: 5, useNativeDriver: true }),
      ]),

      Animated.delay(600),

      // ── Core Full Open Ripple Wave ──
      Animated.parallel([
        Animated.timing(startupAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        Animated.timing(rippleScale, { toValue: 7.5, duration: 1200, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(rippleOpacity, { toValue: 0.9, duration: 200, useNativeDriver: true }),
          Animated.timing(rippleOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      setIsPlayingSequence(false);
      startFloats();
      setActiveMoodText('Interactive Mood Core Live');
      setActiveMoodDesc('Hover or tap any lifestyle node to expand your memory aura.');
    });
  };

  // ── AMBIENT BREATHING CORE ─────────────────────────────────────────────────
  const startAmbientCore = () => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseCoreScale, {
            toValue: 1.18,
            duration: 1800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseCoreOpacity, {
            toValue: 0.8,
            duration: 1800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseCoreScale, {
            toValue: 0.92,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseCoreOpacity, {
            toValue: 0.35,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ]),
      ])
    ).start();
  };

  // ── RING ROTATIONS ─────────────────────────────────────────────────────────
  const startRingRotations = () => {
    Animated.loop(
      Animated.timing(ring1Rotation, {
        toValue: 1,
        duration: 28000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(ring2Rotation, {
        toValue: 1,
        duration: 36000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  // ── NATURAL FLOATING MOTION IN ORBIT ───────────────────────────────────────
  const startFloats = () => {
    iconFloatOffsets.forEach((floatOffset, idx) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatOffset, {
            toValue: -6 - idx * 2,
            duration: 1800 + idx * 300,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(floatOffset, {
            toValue: 6 + idx * 2,
            duration: 2000 + idx * 300,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ).start();
    });
  };

  // ── DYNAMIC CORE RIPPLE EXPANSION ──────────────────────────────────────────
  const triggerPulseRipple = () => {
    if (isPlayingSequence) return;
    rippleScale.setValue(0);
    rippleOpacity.setValue(1);
    
    Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: 8.5,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.bezier(0.1, 0.8, 0.3, 1),
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Soft feedback
    setActiveMoodText('Gravity Core Expansion');
    setActiveMoodDesc('Emitting radial emotional waves across local journal nodes.');
  };

  // ── FLASH ELECTRIC ENERGY ARC ─────────────────────────────────────────────
  const triggerElectricArc = () => {
    if (isPlayingSequence) return;
    const targetIdx = Math.floor(Math.random() * ICON_COUNT);
    setActiveArcIcon(targetIdx);
    arcRotation.setValue(0);
    
    Animated.sequence([
      Animated.parallel([
        Animated.timing(arcOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(arcRotation, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(arcOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();

    setActiveMoodText('Energy Synchronization');
    setActiveMoodDesc(`Transmitting sync signals to ${ICON_DETAILS[targetIdx].name} memory array.`);
  };

  // ── HANDLE ICON SELECTION / FOCUS ──────────────────────────────────────────
  const handleSelectIcon = (index: number) => {
    if (isPlayingSequence) return;
    setSelectedIconIndex(index);
    setActiveMoodText(ICON_DETAILS[index].title);
    setActiveMoodDesc(ICON_DETAILS[index].desc);

    // Bounce scale on select
    iconScales[index].setValue(1.4);
    Animated.spring(iconScales[index], {
      toValue: 1.0,
      friction: 4,
      useNativeDriver: true,
    }).start();

    // Trigger local sparkle flash
    sparkleScale.setValue(0.5);
    sparkleOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(sparkleScale, { toValue: 1.8, duration: 500, useNativeDriver: true }),
      Animated.timing(sparkleOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  // ── METADATA & COORDINATES FOR 5 ORBIT ELEMENTS ────────────────────────────
  const ICON_DETAILS = [
    {
      name: 'Windmill (Nature)',
      title: 'Aura Bloom Active',
      desc: 'Spending time in parks, hiking, or viewing natural trails stimulates slow-wave delta focus.',
      icon: 'weather-sunset' as const,
      color: EMERALD_GREEN,
      bg: 'rgba(16, 185, 129, 0.15)',
    },
    {
      name: 'Coffee Mug',
      title: 'Mindful Brewing Mode',
      desc: 'A warm espresso or sensory tea breaks down stress spikes and provides a 15-minute mental window.',
      icon: 'coffee' as const,
      color: SUNSET_ORANGE,
      bg: 'rgba(249, 115, 22, 0.15)',
    },
    {
      name: 'Walking Figure',
      title: 'Aerobic Fluid Motion',
      desc: 'Logging structured steps aligns cardiovascular heart rates and sparks creative neural flow.',
      icon: 'walk' as const,
      color: SKY_BLUE,
      bg: 'rgba(14, 165, 233, 0.15)',
    },
    {
      name: 'Shopping Bag',
      title: 'Acquisition & Reward',
      desc: 'Selecting carefully planned supplies stimulates healthy dopaminergic baseline loops.',
      icon: 'shopping' as const,
      color: ROSE_PINK,
      bg: 'rgba(236, 72, 153, 0.15)',
    },
    {
      name: 'Food Utensils',
      title: 'Nutritional Focus',
      desc: 'Balanced nourishment triggers serotonin synthesis, fueling long-term cellular cognitive energy.',
      icon: 'silverware-fork-knife' as const,
      color: NEON_PURPLE,
      bg: 'rgba(168, 85, 247, 0.15)',
    },
  ];

  // Calculate dynamic rotation interpolations
  const spin1 = ring1Rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spin2 = ring2Rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  const arcSpin = arcRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Pitch-black cosmic container with ambient glow circles ── */}
      <View style={StyleSheet.absoluteFill}>
        {/* Soft background blooms */}
        <View style={[s.glowCircle, { backgroundColor: 'rgba(13, 148, 136, 0.08)', width: 380, height: 380, borderRadius: 190, top: '25%', left: '10%' }]} />
        <View style={[s.glowCircle, { backgroundColor: 'rgba(14, 165, 233, 0.08)', width: 300, height: 300, borderRadius: 150, top: '35%', right: '5%' }]} />
        <View style={[s.glowCircle, { backgroundColor: 'rgba(236, 72, 153, 0.06)', width: 260, height: 260, borderRadius: 130, top: '15%', left: '20%' }]} />

        {/* Twinkling Stars */}
        {stars.map((star) => (
          <View
            key={star.id}
            style={[
              s.star,
              {
                left: star.x,
                top: star.y,
                width: star.size,
                height: star.size,
                borderRadius: star.size / 2,
              },
            ]}
          />
        ))}
      </View>

      {/* ── HEADER ── */}
      <View style={[s.headerContainer, { marginTop: insets.top + 10 }]}>
        <View style={s.headerTitleRow}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={s.headerLogo}
          />
          <Text style={s.headerTitle}>LifeLens Core</Text>
        </View>
        <Text style={s.headerLabel}>CINEMATIC ORB SEQUENCE</Text>
      </View>

      {/* ── CENTRAL MOTION ORB DESIGN ── */}
      <View style={s.orbSceneContainer}>
        
        {/* Pulsing Backlit Bloom */}
        <Animated.View
          style={[
            s.backlitGlow,
            {
              transform: [{ scale: pulseCoreScale }],
              opacity: Animated.multiply(pulseCoreOpacity, startupAnim),
            },
          ]}
        />

        {/* Outer Rotating Neon Ring */}
        <Animated.View
          style={[
            s.neonRingOuter,
            {
              transform: [{ rotate: spin1 }, { scale: startupAnim }],
              opacity: startupAnim,
            },
          ]}
        />

        {/* Inner Rotating Neon Ring */}
        <Animated.View
          style={[
            s.neonRingInner,
            {
              transform: [{ rotate: spin2 }, { scale: startupAnim }],
              opacity: startupAnim,
            },
          ]}
        />

        {/* Dynamic Expanding Wave Ripple */}
        <Animated.View
          style={[
            s.ripplePulse,
            {
              transform: [{ scale: rippleScale }],
              opacity: rippleOpacity,
            },
          ]}
        />

        {/* Stardust drift particles */}
        <Animated.View
          style={[
            s.particleContainer,
            {
              opacity: particlesOpacity,
              transform: [{ scale: particlesScale }],
            },
          ]}
        >
          {Array.from({ length: 14 }).map((_, i) => {
            const angle = (i * 2 * Math.PI) / 14;
            const px = ORBIT_RADIUS * 0.7 * Math.cos(angle);
            const py = ORBIT_RADIUS * 0.7 * Math.sin(angle);
            return (
              <View
                key={i}
                style={[
                  s.particleDot,
                  {
                    left: px,
                    top: py,
                    backgroundColor: i % 2 === 0 ? NEON_PURPLE : SKY_BLUE,
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Floating/Twinkling Sparkle Bloom around active operations */}
        <Animated.View
          style={[
            s.sparkleCluster,
            {
              opacity: sparkleOpacity,
              transform: [{ scale: sparkleScale }],
            },
          ]}
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const angle = (i * 2 * Math.PI) / 6;
            const sx = 40 * Math.cos(angle);
            const sy = 40 * Math.sin(angle);
            return (
              <View
                key={i}
                style={[
                  s.sparkleDot,
                  {
                    left: sx,
                    top: sy,
                    backgroundColor: '#FFF',
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Center Heartbeat Breathing Core */}
        <Animated.View style={[s.coreContainer, { opacity: startupAnim }]}>
          <TouchableOpacity activeOpacity={0.8} onPress={triggerPulseRipple} style={s.coreTouchable}>
            <Animated.View
              style={[
                s.coreIconGlowWrapper,
                {
                  transform: [{ scale: pulseCoreScale }],
                },
              ]}
            >
              <Image
                source={require('@/assets/images/icon.png')}
                style={s.coreIconImage}
                contentFit="contain"
              />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── 5 Lifestyle Orbit Nodes ── */}
        {ICON_DETAILS.map((detail, index) => {
          // Angle formula starting at -90 degrees (top) and stepping 72 degrees per node
          const baseAngleDegrees = -90 + index * 72;
          const baseAngleRadians = (baseAngleDegrees * Math.PI) / 180;
          
          const posX = ORBIT_RADIUS * Math.cos(baseAngleRadians);
          const posY = ORBIT_RADIUS * Math.sin(baseAngleRadians);

          return (
            <Animated.View
              key={index}
              style={[
                s.orbitNodeWrapper,
                {
                  left: posX,
                  top: posY,
                  opacity: iconOpacities[index],
                  transform: [
                    { scale: iconScales[index] },
                    { translateY: Animated.add(iconTranslateYs[index], iconFloatOffsets[index]) },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleSelectIcon(index)}
                style={[
                  s.iconBubble,
                  {
                    backgroundColor: detail.bg,
                    borderColor: selectedIconIndex === index ? detail.color : BORDER_WHITE,
                    shadowColor: detail.color,
                  },
                ]}
              >
                <MaterialCommunityIcons name={detail.icon} size={22} color={detail.color} />

                {/* Steam squiggles only for Coffee Mug */}
                {index === 1 && (
                  <Animated.View
                    style={[
                      s.steamContainer,
                      {
                        opacity: steamOpacity,
                        transform: [{ translateY: steamTranslate }],
                      },
                    ]}
                  >
                    <View style={s.steamWave} />
                    <View style={[s.steamWave, { marginLeft: 3, height: 6 }]} />
                  </Animated.View>
                )}

                {/* Ghost Motion Trail for walking figure */}
                {index === 2 && (
                  <Animated.View style={[s.trailGhost, { opacity: trailOpacity }]} />
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* ── FOOTER INTERACTIVE GLASS CARD ── */}
      <View style={[s.footerContainer, { marginBottom: insets.bottom + 20 }]}>
        <View style={s.glassCard}>
          <View style={s.cardGlowBorder} />
          
          <Text style={s.moodTitle}>{activeMoodText}</Text>
          <Text style={s.moodDesc}>{activeMoodDesc}</Text>

          {/* Interactive Button Row */}
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.actionButton} onPress={runStartupSequence}>
              <Feather name="play" size={14} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={s.actionButtonText}>Replay Startup</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.actionButton, { borderColor: 'rgba(14, 165, 233, 0.3)' }]} onPress={triggerPulseRipple}>
              <Feather name="activity" size={14} color={SKY_BLUE} style={{ marginRight: 6 }} />
              <Text style={[s.actionButtonText, { color: SKY_BLUE }]}>Pulse Wave</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.actionButton, { borderColor: 'rgba(168, 85, 247, 0.3)' }]} onPress={triggerElectricArc}>
              <Feather name="zap" size={14} color={NEON_PURPLE} style={{ marginRight: 6 }} />
              <Text style={[s.actionButtonText, { color: NEON_PURPLE }]}>Energy Arc</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OBSIDIAN,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glowCircle: {
    position: 'absolute',
    borderRadius: 9999,
  },
  star: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  headerContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    gap: 8,
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(13, 148, 136, 0.8)',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  orbSceneContainer: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 40,
  },
  backlitGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(13, 148, 136, 0.22)',
  },
  neonRingOuter: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    borderStyle: 'dashed',
  },
  neonRingInner: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
    borderStyle: 'dashed',
  },
  ripplePulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: NEON_PURPLE,
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
  },
  particleContainer: {
    position: 'absolute',
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleDot: {
    position: 'absolute',
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    opacity: 0.8,
  },
  sparkleCluster: {
    position: 'absolute',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  coreContainer: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreTouchable: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  coreIconGlowWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F1123',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NEON_PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  coreIconImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  orbitNodeWrapper: {
    position: 'absolute',
    width: 50,
    height: 50,
    marginLeft: -25,
    marginTop: -25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  steamContainer: {
    position: 'absolute',
    top: -12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 12,
  },
  steamWave: {
    width: 1.5,
    height: 8,
    backgroundColor: SUNSET_ORANGE,
    borderRadius: 0.75,
    opacity: 0.6,
  },
  trailGhost: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
    top: 5,
  },
  footerContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  glassCard: {
    backgroundColor: GLASS_BG,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.2,
    borderColor: BORDER_WHITE,
    shadowColor: NEON_PURPLE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  cardGlowBorder: {
    position: 'absolute',
    top: 0,
    left: '25%',
    width: '50%',
    height: 1.5,
    backgroundColor: NEON_PURPLE,
    opacity: 0.6,
  },
  moodTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 6,
  },
  moodDesc: {
    fontSize: 13,
    color: 'rgba(210, 210, 230, 0.8)',
    lineHeight: 18,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  actionButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#FFF',
    fontWeight: 'bold',
  },
});
