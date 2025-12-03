import i18n from '@/constants/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, View } from 'react-native';

export default function Welcome() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [role, newUser] = await Promise.all([
          AsyncStorage.getItem('userRole'),
          AsyncStorage.getItem('isNewUser'),
        ]);
        console.log('Fetched userRole:', role, 'isNewUser:', newUser);
        setUserRole(role);
        setIsNewUser(newUser === 'true');
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert(
          i18n.t('error', { defaultValue: 'Error' }),
          i18n.t('welcome_error', {
            defaultValue: 'Failed to load welcome screen. Please try again.',
          })
        );
        router.replace('/role-select' as any);
      }
    };
    fetchUserData();
  }, [router]);

  useEffect(() => {
    if (userRole === null || isNewUser === null) {
      console.log('Waiting for userRole and isNewUser to be set:', {
        userRole,
        isNewUser,
      });
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(async () => {
        try {
          await AsyncStorage.setItem('hasCompletedWelcome', 'true');
          console.log('Navigating with userRole:', userRole, 'isNewUser:', isNewUser);

          if (isNewUser) {
            // 🔹 NEW USER FLOWS
            if (userRole === 'vendor') {
              router.replace('/profile/create/vendor' as any);
            } else if (userRole === 'jobfinder') {
              router.replace('/profile/create/jobfinder' as any);
            } else if (userRole === 'customer') {
              router.replace('/profile/create/customer' as any); // 👈 casted
            } else if (userRole === 'ngo') {
              router.replace('/profile/create/ngo' as any); // 👈 casted
            } else {
              throw new Error('Invalid role');
            }
          } else {
            // 🔹 EXISTING USER FLOWS
            if (userRole === 'vendor') {
              router.replace('/applications'); // this is probably already in typed routes
            } else if (userRole === 'jobfinder') {
              router.replace('/find-gigs');    // same here
            } else if (userRole === 'customer') {
              router.replace('/customer-home' as any); // 👈 casted
            } else if (userRole === 'ngo') {
              router.replace('/ngo-applications' as any); // 👈 casted
            } else {
              throw new Error('Invalid role');
            }
          }
        } catch (error) {
          console.error('Error in welcome navigation:', error);
          Alert.alert(
            i18n.t('error', { defaultValue: 'Error' }),
            i18n.t('invalid_role', {
              defaultValue: 'Invalid role selected. Please choose a role.',
            })
          );
          router.replace('/role-select' as any);
        }
      });
    });
  }, [fadeAnim, userRole, isNewUser, router]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
        {i18n.t('welcome', { defaultValue: 'Welcome!' })}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  title: { fontSize: 30, fontWeight: 'bold', textAlign: 'center' },
});
