import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/constants/i18n';
import { router } from 'expo-router';
import AppBar from '@/components/appbar';

const LANG_KEY = 'userLanguage';

const languages = [
  { code: 'en', label: i18n.t('english') },
  { code: 'hi', label: i18n.t('hindi') },
  { code: 'mr', label: i18n.t('marathi') },
];

export default function Onboarding() {
  const [selectedLang, setSelectedLang] = useState(i18n.locale);

  const selectLanguage = async (code: string) => {
    try {
      await AsyncStorage.setItem(LANG_KEY, code);
      i18n.locale = code;
      setSelectedLang(code);
      router.replace('/login');  // Navigate to login after language is set
    } catch (error) {
      console.error('Error saving userLanguage to AsyncStorage:', error);
    }
  };
return (
  <View style={{ flex: 1, backgroundColor: "#fff" }}>

    <AppBar title={i18n.t('select_language', { defaultValue: 'Select Language' })} />
    <View style={styles.container}>
      {languages.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={[
            styles.button,
            lang.code === selectedLang && styles.buttonSelected
          ]}
          onPress={() => selectLanguage(lang.code)}
        >
          <Text style={styles.buttonText}>{lang.label}</Text>
        </TouchableOpacity>
      ))}
    </View>

  </View>
);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    marginVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ccc',
    width: 220,
    alignItems: 'center',
  },
  buttonSelected: {
    backgroundColor: '#007bff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
  },
});
