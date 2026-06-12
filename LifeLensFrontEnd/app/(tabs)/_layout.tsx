import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { View, Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCalendarUI } from '@/context/calendar-ui';
import { useThemeColors } from '@/constants/design-system';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const router = useRouter();
  const { calendarExpanded, setCalendarExpanded, selectedDate } = useCalendarUI();
  const COLORS = useThemeColors();
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? 'rgba(8, 10, 15, 0.85)' : 'rgba(248, 250, 252, 0.85)',
          borderTopColor: COLORS.surfaceBorder,
          borderTopWidth: 1.2,
          height: 82,
          paddingBottom: 24,
          paddingTop: 6,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 5.15,
          shadowRadius: 12,
          ...Platform.select({
            web: {
              backdropFilter: 'blur(20px)',
              // @ts-ignore
              experimental_backdropFilter: 'blur(20px)',
            },
            default: {},
          }),
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-note"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: COLORS.primary,
              justifyContent: 'center',
              alignItems: 'center',
              top: -12, // floating elevated action button, perfectly centered vertically
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 10,
              elevation: 8,
              borderWidth: 3.5,
              borderColor: COLORS.bg, // cleanly masks with background
            }}>
              <IconSymbol 
                size={30} 
                name="plus" 
                color="#fff" 
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push({ pathname: '/modal', params: { date: selectedDate } });
          },
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="suggestions"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="lightbulb.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
