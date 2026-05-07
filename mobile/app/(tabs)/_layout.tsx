/**
 * Tab Layout — KrishiMitra
 * Premium bottom tab bar with MaterialCommunityIcons — no emojis.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize } from '@/constants/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function TabIcon({
  name,
  focused,
}: {
  name: IconName;
  focused: boolean;
}) {
  return (
    <View style={styles.tabItem}>
      <MaterialCommunityIcons
        name={name}
        size={26}
        color={focused ? Colors.primary : Colors.textMuted}
      />
      {focused && <View style={styles.activePill} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="microphone" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="diagnose"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="leaf" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="history" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="cog-outline" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 84 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 16,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
  },
  activePill: {
    position: 'absolute',
    bottom: -8,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
});
