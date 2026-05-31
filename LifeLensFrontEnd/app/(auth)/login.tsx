import React, { useState } from 'react';
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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { login, resendOTP } = useAuth();
  const router = useRouter();

  const primaryColor = '#8F66FF'; // Standard Premium Purple

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    try {
      await resendOTP(email.trim().toLowerCase());
      setError('A new verification code has been sent successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
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
          <View style={styles.header}>
            <View style={styles.logoIconBg}>
              <IconSymbol size={44} name="eyes" color={primaryColor} />
            </View>
            <ThemedText style={styles.title}>LifeLens</ThemedText>
            <ThemedText style={styles.subtitle}>Your Daily Life Insights</ThemedText>
          </View>

          <View style={styles.form}>
            <ThemedText style={styles.formTitle}>Welcome back</ThemedText>

            {error && (
              <View style={styles.errorAlertContainer}>
                <View style={styles.errorAlert}>
                  <IconSymbol size={18} name="exclamationmark.circle.fill" color="#FF5252" />
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                </View>
                {error.includes("verify") && (
                  <View style={styles.errorActions}>
                    <TouchableOpacity
                      style={styles.errorActionBtn}
                      onPress={() => router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim().toLowerCase() } })}>
                      <ThemedText style={styles.errorActionBtnText}>Verify Email</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.errorActionBtn}
                      onPress={handleResend}
                      disabled={resending}>
                      {resending ? (
                        <ActivityIndicator size="small" color={primaryColor} />
                      ) : (
                        <ThemedText style={styles.errorActionBtnText}>Resend Code</ThemedText>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

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
                  onChangeText={setEmail}
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
                />
                <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeIcon}>
                  <IconSymbol size={20} name={secureText ? 'eye.fill' : 'eye.slash.fill'} color="rgba(255, 255, 255, 0.4)" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.loginBtnText}>Sign In</ThemedText>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <ThemedText style={styles.footerText}>New to LifeLens? </ThemedText>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <ThemedText style={styles.registerLink}>Create Account</ThemedText>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080916',
    justifyContent: 'center',
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
    paddingHorizontal: 24,
    justifyContent: 'center',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 35,
  },
  logoIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(143, 102, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(143, 102, 255, 0.25)',
  },
  title: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingVertical:10
  },
  subtitle: {
    color: '#B0B0C4',
    fontSize: 15,
    opacity: 0.7,
    marginTop: 6,
  },
  form: {
    gap: 18,
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
  formTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorAlertContainer: {
    backgroundColor: '#FF525215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF525230',
    overflow: 'hidden',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  errorActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#FF525220',
    backgroundColor: '#FF525208',
  },
  errorActionBtn: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#FF525220',
  },
  errorActionBtnText: {
    color: '#FF5252',
    fontSize: 13,
    fontWeight: '700',
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
  loginBtn: {
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
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  footerText: {
    color: '#B0B0C4',
    fontSize: 14,
    opacity: 0.8,
  },
  registerLink: {
    color: '#8F66FF',
    fontSize: 14,
    fontWeight: '700',
  },
});
