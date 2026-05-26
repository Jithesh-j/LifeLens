import React from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuth } from '@/context/auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const primaryColor = '#7C4DFF';
  const errorColor = '#FF5252';
  const cardBg = useThemeColor({ light: '#F2F2F7', dark: '#1C1C1E' }, 'background');
  const textColor = useThemeColor({}, 'text');

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of LifeLens?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Profile</ThemedText>
      </View>

      {/* User Card */}
      <View style={[styles.profileCard, { backgroundColor: cardBg }]}>
        <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
          <ThemedText style={styles.avatarText}>{getInitials(user?.username)}</ThemedText>
        </View>
        <View style={styles.userInfo}>
          <ThemedText style={styles.username}>{user?.username || 'Journaler'}</ThemedText>
          <ThemedText style={styles.email}>{user?.email || 'user@lifelens.com'}</ThemedText>
        </View>
      </View>

      {/* Stats Section */}
      <ThemedText style={styles.sectionTitle}>Your Activity Stats</ThemedText>
      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { backgroundColor: cardBg }]}>
          <IconSymbol size={24} name="paperplane.fill" color={primaryColor} />
          <ThemedText style={styles.statVal}>12</ThemedText>
          <ThemedText style={styles.statLabel}>Total Logs</ThemedText>
        </View>
        <View style={[styles.statBox, { backgroundColor: cardBg }]}>
          <IconSymbol size={24} name="eyes" color={primaryColor} />
          <ThemedText style={styles.statVal}>4 days</ThemedText>
          <ThemedText style={styles.statLabel}>Current Streak</ThemedText>
        </View>
      </View>

      {/* Info Details */}
      <ThemedText style={styles.sectionTitle}>Account Details</ThemedText>
      <View style={[styles.detailsList, { backgroundColor: cardBg }]}>
        <View style={styles.detailItem}>
          <ThemedText style={styles.detailLabel}>Account Type</ThemedText>
          <ThemedText style={styles.detailValue}>Standard Free</ThemedText>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailItem}>
          <ThemedText style={styles.detailLabel}>Joined Date</ThemedText>
          <ThemedText style={styles.detailValue}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Today'}
          </ThemedText>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={[styles.logoutBtn, { borderColor: errorColor }]} onPress={handleLogout}>
        <IconSymbol size={20} name="exclamationmark.circle.fill" color={errorColor} style={styles.logoutIcon} />
        <ThemedText style={[styles.logoutBtnText, { color: errorColor }]}>Sign Out</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    gap: 16,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  userInfo: {
    justifyContent: 'center',
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
  },
  email: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.6,
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    gap: 6,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  detailsList: {
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  detailLabel: {
    fontSize: 15,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#8E8E9330',
  },
  logoutBtn: {
    flexDirection: 'row',
    height: 52,
    borderWidth: 1.5,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  logoutIcon: {
    marginRight: 4,
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
