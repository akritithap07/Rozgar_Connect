// types/expo-router.d.ts
import { Route } from 'expo-router';

declare module 'expo-router' {
  interface ExpoRouter {
    // Add all your routes here
    '/': Route;
    '/login': Route;
    '/set-pin': Route;
    '/save-user-data': Route;
    '/role-select': Route;
    '/welcome': Route;
    '/(tabs)': Route;
    '/(tabs2)': Route;
    '/profile/create/jobfinder': Route;
    '/profile/create/vendor': Route;
    '/onboarding': Route;
    '/modal': Route;
  }
}