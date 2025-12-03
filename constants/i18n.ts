// constants/i18n.ts
import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

// Initialize i18n instance
const i18n = new I18n({
  en,
  hi,
  mr,
});

// Enable fallbacks to default to 'en' if translation is missing
i18n.fallbacks = true;

// Set the locale using expo-localization's getLocales()
i18n.locale = Localization.getLocales()[0]?.languageCode || 'en';

export default i18n;