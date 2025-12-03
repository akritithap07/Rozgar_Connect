import AppBar from '@/components/appbar';
import i18n from '@/constants/i18n';
import { db } from '@/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type UserRole = 'vendor' | 'jobfinder' | 'customer' | 'ngo';

export default function SetPin() {
  const [pin, setPin] = useState('');
  const router = useRouter();

  const handleSubmit = async () => {
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert(
        i18n.t('validation_error', { defaultValue: 'Validation Error' }),
        i18n.t('invalid_pin', { defaultValue: 'Please enter a valid 4-digit PIN' })
      );
      return;
    }

    try {
      const phoneNumber = await AsyncStorage.getItem('phoneNumber');
      const storedRole = await AsyncStorage.getItem('userRole');

      // Validate role as one of the allowed values (including NGO)
      const validRoles: UserRole[] = ['vendor', 'jobfinder', 'customer', 'ngo'];
      const userRole = validRoles.includes(storedRole as UserRole)
        ? (storedRole as UserRole)
        : null;

      if (!phoneNumber || !userRole) {
        console.log('Missing or invalid phoneNumber or userRole:', { phoneNumber, storedRole });
        Alert.alert(
          i18n.t('error', { defaultValue: 'Error' }),
          i18n.t('missing_data', {
            defaultValue: 'Phone number or role not found. Please log in again.',
          })
        );
        router.replace('/login' as any);
        return;
      }

      // Save PIN, userRole, and isNewUser to Firestore
      const userDocRef = doc(db, 'users', phoneNumber);
      await setDoc(
        userDocRef,
        { role: userRole, pin: pin, isNewUser: true },
        { merge: true }
      );
      console.log('Firestore write successful: role, pin, and isNewUser saved', { userRole });

      // Update AsyncStorage
      await AsyncStorage.multiSet([
        ['userPin', pin],
        ['hasSetPin', 'true'],
        ['isLoggedIn', 'true'],
        ['hasCompletedWelcome', 'false'],
        ['isNewUser', 'true'], // Mark user as new
      ]);
      console.log('AsyncStorage updated: userPin, hasSetPin, isLoggedIn, hasCompletedWelcome, isNewUser');

      Alert.alert(
        i18n.t('success', { defaultValue: 'Success' }),
        i18n.t('pin_set_success', { defaultValue: 'PIN set successfully' }),
        [
          {
            text: i18n.t('ok', { defaultValue: 'OK' }),
            onPress: () => router.replace('/welcome' as any),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving PIN and user data:', error);
      Alert.alert(
        i18n.t('error', { defaultValue: 'Error' }),
        i18n.t('pin_set_failed', { defaultValue: 'Failed to set PIN. Please try again.' })
      );
      router.replace('/login' as any);
    }
  };

  return (
  <View style={{ flex: 1, backgroundColor: "#fff" }}>

    <AppBar title={i18n.t('set_pin', { defaultValue: 'Set PIN' })} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.subHeading}>
            {i18n.t('enter_4_digit_pin', { defaultValue: 'Enter a 4-digit PIN' })}
          </Text>

          <View style={styles.pinContainer}>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              maxLength={4}
              autoFocus
              textAlign="center"
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.buttonText}>
              {i18n.t('submit', { defaultValue: 'Submit' })}
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingBottom: 100,
  },
  formContainer: {
    width: '100%',
    padding: 20,
    maxWidth: 400,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subHeading: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  pinInput: {
    width: 120,
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    fontSize: 24,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
