import { Tabs, useRouter } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCalendarUI } from '@/context/calendar-ui';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { calendarExpanded, setCalendarExpanded, selectedDate } = useCalendarUI();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
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
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="lightbulb.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-note"
        options={{
          title: '',
          tabBarIcon: ({ color }) => (
            <IconSymbol 
              size={32} 
              name={calendarExpanded ? "minus.circle.fill" : "plus.circle.fill"} 
              color="#7C4DFF" 
            />
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
