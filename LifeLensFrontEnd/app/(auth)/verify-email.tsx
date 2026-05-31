import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { user, verifyOTP, resendOTP, logout } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  
  // Resend code countdown timer state (60 seconds)
  const [countdown, setCountdown] = useState(0);
  const textInputRef = useRef<TextInput>(null);

  const activeEmail = email || user?.email || '';
  const primaryColor = '#8F66FF'; // AuraJournal Luxury Violet
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  // Cooldown countdown effect
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Auto-trigger verification when 6 digits are typed
  useEffect(() => {
    if (code.length === 6) {
      handleVerify(code);
    }
  }, [code]);

  const handleVerify = async (otpCode: string = code) => {
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setError(null);
    setSuccess(null);
    setVerifying(true);
    Keyboard.dismiss();

    try {
      await verifyOTP(activeEmail.trim().toLowerCase(), otpCode);
      setSuccess('Account verified successfully!');
      // Redirection to tabs is handled automatically by the AuthProvider navigation guard!
    } catch (err: any) {
      setError(err.message || 'Invalid verification code.');
      setCode(''); // Clear invalid code
      // Delay focusing back to let user read the error
      setTimeout(() => textInputRef.current?.focus(), 800);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setError(null);
    setSuccess(null);
    setCountdown(60); // Start 60-second cooldown timer

    try {
      await resendOTP(activeEmail.trim().toLowerCase());
      setSuccess('A new verification code has been sent!');
      setCode('');
      textInputRef.current?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Please try again.');
      setCountdown(0); // Reset timer on failure
    }
  };

  const handleBackToLogin = async () => {
    Keyboard.dismiss();
    await logout();
    router.replace('/(auth)/login');
  };

  const renderCells = () => {
    const cells = Array(6).fill(0);
    return (
      <View style={styles.codeRow}>
        {cells.map((_, idx) => {
          const digit = code[idx] || '';
          const isFocused = code.length === idx && verifying === false;
          return (
            <View
              key={idx}
              style={[
                styles.codeCell,
                { borderColor: primaryColor + '20' },
                isFocused && [styles.codeCellFocused, { borderColor: primaryColor }],
              ]}>
              <ThemedText style={styles.codeCellText}>
                {digit}
              </ThemedText>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={() => textInputRef.current?.focus()}>
      <ThemedView style={styles.container}>
        {/* Glow Circles for Premium Aesthetics */}
        <View style={styles.glowCircle1} />
        <View style={styles.glowCircle2} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          
          <View style={styles.header}>
            <View style={[styles.logoIconBg, { backgroundColor: primaryColor + '15' }]}>
              <IconSymbol size={44} name="lightbulb.fill" color={primaryColor} />
            </View>
            <ThemedText style={styles.title}>Check Your Email</ThemedText>
            <ThemedText style={styles.subtitle}>
              We've sent a 6-digit verification code to
            </ThemedText>
            <ThemedText style={[styles.emailHighlight, { color: primaryColor }]}>
              {activeEmail}
            </ThemedText>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorAlert}>
                <IconSymbol size={18} name="exclamationmark.circle.fill" color="#FF5252" />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            )}

            {success && (
              <View style={styles.successAlert}>
                <IconSymbol size={18} name="checkmark.circle.fill" color="#34D399" />
                <ThemedText style={styles.successText}>{success}</ThemedText>
              </View>
            )}

            {/* Premium Overlay Numeric Input Field */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => textInputRef.current?.focus()}
              style={styles.inputArea}>
              {renderCells()}
              <TextInput
                ref={textInputRef}
                style={styles.hiddenInput}
                value={code}
                onChangeText={(val) => setCode(val.replace(/[^0-9]/g, ''))}
                maxLength={6}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoFocus={true}
                editable={!verifying}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.verifyBtn, { backgroundColor: primaryColor }]}
              onPress={() => handleVerify()}
              disabled={verifying || code.length !== 6}>
              {verifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.verifyBtnText}>Verify Account</ThemedText>
              )}
            </TouchableOpacity>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={handleResend}
                disabled={countdown > 0}
                style={[styles.actionBtn, countdown > 0 && styles.disabledBtn]}>
                <IconSymbol 
                  size={16} 
                  name="clock.arrow.circlepath" 
                  color={countdown > 0 ? 'rgba(255,255,255,0.3)' : primaryColor} 
                  style={{ marginRight: 6 }} 
                />
                <ThemedText style={[styles.actionBtnText, { color: countdown > 0 ? 'rgba(255,255,255,0.3)' : primaryColor }]}>
                  {countdown > 0 ? `Resend Code (${countdown}s)` : 'Resend Code'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.backBtn} onPress={handleBackToLogin}>
              <IconSymbol size={16} name="arrow.right" color="rgba(255,255,255,0.6)" style={styles.backIcon} />
              <ThemedText style={styles.backBtnText}>Back to Sign In</ThemedText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ThemedView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#080916',
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    zIndex: 2,
  },
  glowCircle1: {
    position: 'absolute',
    top: 40,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(143, 102, 255, 0.08)',
    zIndex: 1,
  },
  glowCircle2: {
    position: 'absolute',
    bottom: 100,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoIconBg: {
    width: 76,
    height: 76,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 6,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emailHighlight: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  form: {
    gap: 20,
    paddingHorizontal: 8,
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
    fontSize: 13.5,
    fontWeight: '500',
    flex: 1,
  },
  successAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34D39915',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#34D39930',
  },
  successText: {
    color: '#34D399',
    fontSize: 13.5,
    fontWeight: '500',
    flex: 1,
  },
  inputArea: {
    alignItems: 'center',
    marginVertical: 10,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    gap: 8,
  },
  codeCell: {
    flex: 1,
    height: 52,
    borderWidth: 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  codeCellFocused: {
    backgroundColor: 'rgba(143, 102, 255, 0.06)',
    shadowColor: '#8F66FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  codeCellText: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: '#FFFFFF',
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  verifyBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#8F66FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  backBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  backIcon: {
    marginRight: 6,
    transform: [{ rotate: '180deg' }], // point left
    opacity: 0.6,
  },
  backBtnText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
});
