import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Animated,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const primaryColor = '#8F66FF'; // Standard Premium Purple

  // --- Adorable AI Character Animations ---
  const eyesScaleY = useRef(new Animated.Value(1)).current;
  const pupilOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const shutterTranslateY = useRef(new Animated.Value(25)).current; // starts down (revealed)
  const mouthScaleX = useRef(new Animated.Value(1)).current;
  const mouthScaleY = useRef(new Animated.Value(1)).current;

  // Single-blink animation
  const triggerBlink = () => {
    // Only trigger if eyes are currently open (scale is near 1)
    // @ts-ignore
    if (eyesScaleY._value < 0.5) return;

    Animated.sequence([
      Animated.timing(eyesScaleY, { toValue: 0.1, duration: 100, useNativeDriver: true }),
      Animated.timing(eyesScaleY, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  // When focusing Username input: look slightly UP/LEFT and blink
  const handleUsernameFocus = () => {
    Animated.spring(shutterTranslateY, { toValue: 25, tension: 45, friction: 6, useNativeDriver: true }).start();
    Animated.spring(mouthScaleX, { toValue: 1, useNativeDriver: true }).start();
    Animated.spring(mouthScaleY, { toValue: 1, useNativeDriver: true }).start();

    triggerBlink();
    Animated.spring(pupilOffset, {
      toValue: { x: -2, y: -2 },
      tension: 40,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  // When focusing Email input: look slightly UP/RIGHT and blink
  const handleEmailFocus = () => {
    Animated.spring(shutterTranslateY, { toValue: 25, tension: 45, friction: 6, useNativeDriver: true }).start();
    Animated.spring(mouthScaleX, { toValue: 1, useNativeDriver: true }).start();
    Animated.spring(mouthScaleY, { toValue: 1, useNativeDriver: true }).start();

    triggerBlink();
    Animated.spring(pupilOffset, {
      toValue: { x: 2, y: -2 },
      tension: 40,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  // Shift pupils horizontally as the user types
  const handleEmailChange = (text: string) => {
    setEmail(text);
    const shiftX = Math.max(-5, Math.min(5, (text.length - 15) * 0.3));
    Animated.timing(pupilOffset.x, {
      toValue: shiftX,
      duration: 50,
      useNativeDriver: true,
    }).start();
  };

  // When focusing Password or Confirm inputs: cover eyes (if secure) or look DOWN (if revealed)
  const handlePasswordFocus = () => {
    if (secureText) {
      // Cover eyes
      Animated.spring(shutterTranslateY, {
        toValue: -15, // slide hands UP
        tension: 45,
        friction: 6,
        useNativeDriver: true,
      }).start();
      Animated.spring(mouthScaleX, { toValue: 0.8, useNativeDriver: true }).start();
      Animated.spring(mouthScaleY, { toValue: 0.8, useNativeDriver: true }).start();
    } else {
      triggerBlink();
      // Look down
      Animated.spring(pupilOffset, {
        toValue: { x: 0, y: 4 },
        tension: 40,
        friction: 5,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePasswordBlur = () => {
    // Reset positions when focusing away
    Animated.spring(shutterTranslateY, { toValue: 25, tension: 45, friction: 6, useNativeDriver: true }).start();
    Animated.spring(pupilOffset, { toValue: { x: 0, y: 0 }, tension: 40, friction: 5, useNativeDriver: true }).start();
    Animated.spring(mouthScaleX, { toValue: 1, useNativeDriver: true }).start();
    Animated.spring(mouthScaleY, { toValue: 1, useNativeDriver: true }).start();
  };

  // Toggle secure visibility and play spring transitions
  const handleToggleSecureText = () => {
    const nextSecure = !secureText;
    setSecureText(nextSecure);

    if (nextSecure) {
      // Hide password -> Cover eyes
      Animated.spring(shutterTranslateY, {
        toValue: -15, // cover eyes
        tension: 45,
        friction: 6,
        useNativeDriver: true,
      }).start();
      Animated.spring(mouthScaleX, { toValue: 0.8, useNativeDriver: true }).start();
      Animated.spring(mouthScaleY, { toValue: 0.8, useNativeDriver: true }).start();
    } else {
      // Reveal password -> Drop hands & open mouth wide in surprise
      Animated.spring(shutterTranslateY, {
        toValue: 25, // reveal eyes
        tension: 45,
        friction: 6,
        useNativeDriver: true,
      }).start();
      Animated.spring(pupilOffset, {
        toValue: { x: 0, y: 4 }, // look down
        tension: 40,
        friction: 5,
        useNativeDriver: true,
      }).start();

      Animated.sequence([
        Animated.spring(mouthScaleX, { toValue: 1.4, useNativeDriver: true }),
        Animated.spring(mouthScaleY, { toValue: 2.2, useNativeDriver: true }),
      ]).start();
    }
  };

  const handleRegister = async () => {
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(username.trim(), email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Try a different username/email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Background Glow */}
        <View style={styles.glowCircle1} />
        <View style={styles.glowCircle2} />
        <View style={styles.glowCircle3} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Animated AI Character Logo */}
            <View style={styles.header}>
              <View style={styles.logoIconBg}>
                <View style={styles.faceContainer}>
                  {/* Left Eye */}
                  <Animated.View style={[styles.eyeBg, { transform: [{ scaleY: eyesScaleY }] }]}>
                    <Animated.View style={[styles.pupil, { transform: pupilOffset.getTranslateTransform() }]} />
                  </Animated.View>

                  {/* Right Eye */}
                  <Animated.View style={[styles.eyeBg, { transform: [{ scaleY: eyesScaleY }] }]}>
                    <Animated.View style={[styles.pupil, { transform: pupilOffset.getTranslateTransform() }]} />
                  </Animated.View>

                  {/* Shutter Hands (Slides up to cover eyes in secure state) */}
                  <Animated.View style={[styles.shutterHands, { transform: [{ translateY: shutterTranslateY }] }]}>
                    <View style={styles.leftHand} />
                    <View style={styles.rightHand} />
                  </Animated.View>
                </View>

                {/* Mouth */}
                <Animated.View style={[styles.mouth, { transform: [{ scaleX: mouthScaleX }, { scaleY: mouthScaleY }] }]} />
              </View>
              <ThemedText style={styles.title}>Get Started</ThemedText>
              <ThemedText style={styles.subtitle}>Begin your AI wellness journal journey</ThemedText>
            </View>

            <View style={styles.form}>
              {error && (
                <View style={styles.errorAlert}>
                  <IconSymbol size={18} name="exclamationmark.circle.fill" color="#FF5252" />
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                </View>
              )}

              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Username</ThemedText>
                <View style={styles.inputWrapper}>
                  <IconSymbol size={20} name="person.fill" color={primaryColor} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="johndoe"
                    placeholderTextColor="rgba(255, 255, 255, 0.35)"
                    autoCapitalize="none"
                    value={username}
                    onChangeText={setUsername}
                    onFocus={handleUsernameFocus}
                    onBlur={handlePasswordBlur}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Email Address</ThemedText>
                <View style={styles.inputWrapper}>
                  <IconSymbol size={20} name="envelope.fill" color={primaryColor} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@domain.com"
                    placeholderTextColor="rgba(255, 255, 255, 0.35)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={handleEmailChange}
                    onFocus={handleEmailFocus}
                    onBlur={handlePasswordBlur}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Password</ThemedText>
                <View style={styles.inputWrapper}>
                  <IconSymbol size={20} name="lock.fill" color={primaryColor} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255, 255, 255, 0.35)"
                    secureTextEntry={secureText}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                  />
                  <TouchableOpacity onPress={handleToggleSecureText} style={styles.eyeIcon}>
                    <IconSymbol size={20} name={secureText ? 'eye.fill' : 'eye.slash.fill'} color="rgba(255, 255, 255, 0.4)" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Confirm Password</ThemedText>
                <View style={styles.inputWrapper}>
                  <IconSymbol size={20} name="lock.fill" color={primaryColor} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255, 255, 255, 0.35)"
                    secureTextEntry={secureText}
                    autoCapitalize="none"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.registerBtn}
                onPress={handleRegister}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.registerBtnText}>Create Account</ThemedText>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <ThemedText style={styles.footerText}>Already have an account? </ThemedText>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <ThemedText style={styles.loginLink}>Sign In</ThemedText>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080916',
  },
  glowCircle1: {
    position: 'absolute',
    top: 40,
    left: -100,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(143, 102, 255, 0.10)',
    zIndex: 0,
  },
  glowCircle2: {
    position: 'absolute',
    bottom: 100,
    right: -120,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    zIndex: 0,
  },
  glowCircle3: {
    position: 'absolute',
    top: '40%',
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(6, 182, 212, 0.07)',
    zIndex: 0,
  },
  keyboardView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoIconBg: {
    width: 90,
    height: 90,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(143, 102, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(143, 102, 255, 0.25)',
    overflow: 'hidden',
    position: 'relative',
  },
  faceContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 70,
    height: 35,
    marginTop: -8,
  },
  eyeBg: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  pupil: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8F66FF',
  },
  shutterHands: {
    position: 'absolute',
    bottom: -22, // hide below
    left: 0,
    right: 0,
    height: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  leftHand: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#8F66FF',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  rightHand: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#8F66FF',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  mouth: {
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8F66FF',
    marginTop: 2,
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: '#B0B0C4',
    fontSize: 15,
    opacity: 0.7,
    marginTop: 4,
    textAlign: 'center',
  },
  form: {
    gap: 16,
    backgroundColor: 'rgba(17, 19, 42, 0.65)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF525215',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF525230',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.85,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
    opacity: 0.8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    color: '#FFF',
  },
  eyeIcon: {
    padding: 4,
  },
  registerBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#8F66FF',
    shadowColor: '#8F66FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    color: '#B0B0C4',
    fontSize: 14,
    opacity: 0.8,
  },
  loginLink: {
    color: '#8F66FF',
    fontSize: 14,
    fontWeight: '700',
  },
});
