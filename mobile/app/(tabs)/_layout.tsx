// Main Tabs Layout
import React from 'react';
import { Tabs } from 'expo-router';
import { ShoppingBag, ShoppingCart, User, List, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { isAdmin } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#AAAAAA',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: Platform.OS === 'ios' ? 80 + insets.bottom : 65 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : insets.bottom + 5,
          paddingTop: 8,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            },
            android: {
              elevation: 10,
            },
            web: {
              boxShadow: '0px -2px 8px rgba(0,0,0,0.06)',
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <ShoppingBag size={size} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <List size={size} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => <ShoppingCart size={size} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          href: isAdmin ? null : '/profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? '/admin' : null,
          tabBarIcon: ({ color, size }) => <ShieldCheck size={size} color={color} strokeWidth={1.5} />,
        }}
      />
    </Tabs>
  );
}
