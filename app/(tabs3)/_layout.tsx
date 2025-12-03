import i18n from '@/constants/i18n';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          height: 90,
          paddingTop: 10,
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          position: 'absolute',
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
          elevation: 5,
        },
        tabBarActiveTintColor: '#007bff',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen
        name="customer-home"
        options={{
          title: i18n.t('customer_home', { defaultValue: 'Customer Home' }),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="service-request"
        options={{
          title: i18n.t('service_requests', { defaultValue: 'Service Requests' }),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'construct' : 'construct-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: i18n.t('chat', { defaultValue: 'Chat' }),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
