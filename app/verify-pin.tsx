import AppBar from '@/components/appbar';
import i18n from '@/constants/i18n';
import { db } from '@/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function VerifyPin() {
  const [pin, setPin] = useState('');
  const router = useRouter();

  const handleVerify = async () => {
    const phoneNumber = await AsyncStorage.getItem('phoneNumber');
    if (!phoneNumber) {
      Alert.alert(
        i18n.t('error', { defaultValue: 'Error' }),
        i18n.t('phone_not_found', {
          defaultValue: 'Phone number not found. Please enter phone number again.',
        })
      );
      router.replace('/login');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      Alert.alert(
        i18n.t('validation_error', { defaultValue: 'Validation Error' }),
        i18n.t('invalid_pin', { defaultValue: 'Please enter a valid 4-digit PIN' })
      );
      return;
    }

    try {
      const userDocRef = doc(db, 'users', phoneNumber);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        // ❌ User not found → send back to login/signup
        Alert.alert(
          i18n.t('error', { defaultValue: 'Error' }),
          i18n.t('user_not_found', {
            defaultValue: 'User not found. Please sign up first.',
          })
        );

        // Optional: clear any stale auth flags
        await AsyncStorage.multiRemove([
          'userPin',
          'hasSetPin',
          'isLoggedIn',
          'isNewUser',
          'userRole',
        ]);

        router.replace('/login');
        return;
      }

      const userData = userSnap.data();
      const storedPin = String(userData.pin ?? '');
      const roleFromDb: string = userData.role || 'jobfinder'; // fallback
      const isNewUserFromDb =
        typeof userData.isNewUser === 'boolean' ? userData.isNewUser : false;

      if (pin !== storedPin) {
        Alert.alert(
          i18n.t('error', { defaultValue: 'Error' }),
          i18n.t('incorrect_pin', { defaultValue: 'Incorrect PIN' })
        );
        return;
      }

      // ✅ PIN correct → store role & flags for welcome screen
      await AsyncStorage.multiSet([
        ['isLoggedIn', 'true'],
        ['userRole', roleFromDb],
        // you can choose to respect Firestore isNewUser or always false.
        ['isNewUser', isNewUserFromDb ? 'true' : 'false'],
      ]);

      Alert.alert(
        i18n.t('success', { defaultValue: 'Success' }),
        i18n.t('pin_verified', { defaultValue: 'PIN verified successfully' }),
        [
          {
            text: i18n.t('ok', { defaultValue: 'OK' }),
            onPress: () => router.replace('/welcome'),
          },
        ]
      );
    } catch (error) {
      console.error('Error verifying PIN:', error);
      Alert.alert(
        i18n.t('error', { defaultValue: 'Error' }),
        i18n.t('pin_verify_failed', {
          defaultValue: 'Failed to verify PIN. Please try again.',
        })
      );
    }
  };

return (
  <View style={{ flex: 1, backgroundColor: "#fff" }}>

    <AppBar title={i18n.t('verify_pin', { defaultValue: 'Verify PIN' })} />

    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.formContainer}>

        <Text style={styles.heading}>
          {i18n.t('verify_pin', { defaultValue: 'Verify PIN' })}
        </Text>

        <Text style={styles.subHeading}>
          {i18n.t('enter_4_digit_pin', { defaultValue: 'Enter your 4-digit PIN' })}
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

        <TouchableOpacity style={styles.submitButton} onPress={handleVerify}>
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
