import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCalendarUI } from '@/context/calendar-ui';

export default function TabLayout() {
  const router = useRouter();
  const { calendarExpanded, setCalendarExpanded, selectedDate } = useCalendarUI();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#8F66FF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.45)',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: '#161932',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
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
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
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
              backgroundColor: '#8F66FF',
              justifyContent: 'center',
              alignItems: 'center',
              top: -12, // floating elevated action button, perfectly centered vertically
              shadowColor: '#8F66FF',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 10,
              elevation: 8,
              borderWidth: 3.5,
              borderColor: '#0A0C1B', // cleanly masks with background
            }}>
              <IconSymbol 
                size={30} 
                name={calendarExpanded ? "xmark" : "plus"} 
                color="#fff" 
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            if (calendarExpanded) {
              setCalendarExpanded(false);
            } else {
              router.push({ pathname: '/modal', params: { date: selectedDate } });
            }
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
