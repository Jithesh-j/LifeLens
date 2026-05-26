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
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
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

  const primaryColor = '#7C4DFF';
  const textColor = useThemeColor({}, 'text');

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
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View style={[styles.logoIconBg, { backgroundColor: primaryColor + '15' }]}>
                <IconSymbol size={44} name="paperplane.fill" color={primaryColor} />
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
                <View style={[styles.inputWrapper, { borderColor: primaryColor + '40' }]}>
                  <IconSymbol size={20} name="house.fill" color={primaryColor} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="johndoe"
                    placeholderTextColor="#8E8E93"
                    autoCapitalize="none"
                    value={username}
                    onChangeText={setUsername}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Email Address</ThemedText>
                <View style={[styles.inputWrapper, { borderColor: primaryColor + '40' }]}>
                  <IconSymbol size={20} name="paperplane.fill" color={primaryColor} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="name@domain.com"
                    placeholderTextColor="#8E8E93"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Password</ThemedText>
                <View style={[styles.inputWrapper, { borderColor: primaryColor + '40' }]}>
                  <IconSymbol size={20} name="house.fill" color={primaryColor} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="••••••••"
                    placeholderTextColor="#8E8E93"
                    secureTextEntry={secureText}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeIcon}>
                    <IconSymbol size={20} name="paperplane.fill" color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>Confirm Password</ThemedText>
                <View style={[styles.inputWrapper, { borderColor: primaryColor + '40' }]}>
                  <IconSymbol size={20} name="house.fill" color={primaryColor} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="••••••••"
                    placeholderTextColor="#8E8E93"
                    secureTextEntry={secureText}
                    autoCapitalize="none"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.registerBtn, { backgroundColor: primaryColor }]}
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
                    <ThemedText style={[styles.loginLink, { color: primaryColor }]}>Sign In</ThemedText>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ThemedView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoIconBg: {
    width: 70,
    height: 70,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.7,
    marginTop: 4,
    textAlign: 'center',
  },
  form: {
    gap: 16,
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
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
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
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
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
    fontSize: 14,
    opacity: 0.7,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
