import AppBar from '@/components/appbar';
import i18n from '@/constants/i18n';
import { db } from '@/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const router = useRouter();

  const handleSendOtp = async () => {
    if (!/^\d{10}$/.test(phoneNumber)) {
      Alert.alert(
        i18n.t('error', { defaultValue: 'Error' }),
        i18n.t('invalid_phone', {
          defaultValue: 'Please enter a valid 10-digit phone number',
        })
      );
      return;
    }
    try {
      await AsyncStorage.setItem('phoneNumber', phoneNumber);
      console.log('Phone number saved (sign up):', phoneNumber);
      setIsOtpSent(true);
      Alert.alert(
        i18n.t('success', { defaultValue: 'Success' }),
        i18n.t('otp_sent_message', {
          defaultValue: 'An OTP has been sent to your phone number',
        })
      );
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      Alert.alert(
        i18n.t('error', { defaultValue: 'Error' }),
        i18n.t('login_failed', {
          defaultValue: 'Failed to log in. Please try again.',
        })
      );
    }
  };

  const handleSignUp = async () => {
    // Only proceed if OTP has been sent
    if (!isOtpSent) {
      return;
    }

    // Basic OTP validation
    if (!/^\d{4,6}$/.test(otp)) {
      console.log('Invalid OTP entered:', otp);
      Alert.alert(
        i18n.t('warning', { defaultValue: 'Warning' }),
        i18n.t('invalid_otp', {
          defaultValue: 'Please enter a valid OTP (4-6 digits).',
        })
      );
      return;
    }

    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      console.log('OTP entered:', otp, 'Navigating to /role-select');
      router.replace('/role-select');
    } catch (error) {
      console.error('Error during login:', error);
      Alert.alert(
        i18n.t('error', { defaultValue: 'Error' }),
        i18n.t('login_failed', {
          defaultValue: 'Failed to log in. Please try again.',
        })
      );
    }
  };

  const handleSignIn = async () => {
    if (!/^\d{10}$/.test(phoneNumber)) {
      Alert.alert(
        i18n.t('error', { defaultValue: 'Error' }),
        i18n.t('invalid_phone', {
          defaultValue: 'Please enter a valid 10-digit phone number',
        })
      );
      return;
    }

    try {
      // Check if user exists in Firestore "users" collection
      const userDocRef = doc(db, 'users', phoneNumber);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        // ❌ User not registered → stay on this page, ask them to sign up
        Alert.alert(
          i18n.t('error', { defaultValue: 'Error' }),
          i18n.t('user_not_found', {
            defaultValue:
              'No account found for this number. Please sign up first.',
          })
        );
        return;
      }

      // ✅ User exists → save phone and go to verify PIN
      await AsyncStorage.setItem('phoneNumber', phoneNumber);
      console.log('Phone number saved for sign in:', phoneNumber);
      router.replace('/verify-pin');
    } catch (error: any) {
      console.error('Error during sign in:', error);
      Alert.alert(
        i18n.t('error', { defaultValue: 'Error' }),
        i18n.t('login_failed', {
          defaultValue: 'Failed to log in. Please try again.',
        })
      );
    }
  };

return (
  <View style={{ flex: 1, backgroundColor: "#fff" }}>
    
    <AppBar title={i18n.t('login', { defaultValue: 'Sign Up/Login' })} />

    <View style={styles.container}>

      {!isOtpSent ? (
        <>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder={i18n.t('enter_phone', {
              defaultValue: 'Enter phone number',
            })}
            keyboardType="phone-pad"
            maxLength={10}
          />

          <TouchableOpacity style={styles.button} onPress={handleSendOtp}>
            <Text style={styles.buttonText}>
              {i18n.t('sign_up', { defaultValue: 'Sign Up' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleSignIn}>
            <Text style={styles.buttonText}>
              {i18n.t('sign_in', { defaultValue: 'Log In' })}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            placeholder={i18n.t('enter_otp', { defaultValue: 'Enter OTP' })}
            keyboardType="numeric"
            maxLength={6}
          />

          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
            <Text style={styles.buttonText}>
              {i18n.t('submit', { defaultValue: 'Submit' })}
            </Text>
          </TouchableOpacity>
        </>
      )}

    </View>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    maxWidth: 300,
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
