import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
export default function RootLayout() {
const router = useRouter();
const [isReady, setIsReady] = useState(false);
const hasInitialized = useRef(false);
useEffect(() => {
console.log('RootLayout useEffect triggered');
if (hasInitialized.current) {
console.log('Already initialized, skipping');
return;
}
let isMounted = true;
const initializeApp = async () => {
try {
console.log('Starting AsyncStorage clear');
await AsyncStorage.multiRemove([
'isLoggedIn',
'hasSetPin',
'userRole',
'phoneNumber',
'hasCompletedWelcome',
'userPin',
]);
console.log('AsyncStorage cleared on app start');
if (isMounted) {
setIsReady(true);
console.log('Navigating to /onboarding');
router.replace('/onboarding');
}
} catch (error) {
console.error('Error initializing app:', error);
if (isMounted) {
setIsReady(true);
console.log('Navigating to /onboarding (error case)');
router.replace('/onboarding');
}
}
};
initializeApp();
hasInitialized.current = true;
return () => {
isMounted = false;
console.log('RootLayout useEffect cleanup');
};
}, [router]);

console.log('RootLayout rendering Stack');
return (
<Stack screenOptions={{ headerShown: false }}>
<Stack.Screen name="index" />
<Stack.Screen name="onboarding" />
<Stack.Screen name="role-select" />
<Stack.Screen name="login" />
<Stack.Screen name="set-pin" />
<Stack.Screen name="verify-pin" />
<Stack.Screen name="welcome" />
<Stack.Screen name="(tabs)" />
<Stack.Screen name="(tabs2)" />
<Stack.Screen name="(tabs3)" />
<Stack.Screen name="(tabs4)" />

<Stack.Screen name="profile/create/jobfinder" />
<Stack.Screen name="profile/create/vendor" />
<Stack.Screen name="profile/create/customer"/>
<Stack.Screen name="profile/create/ngo"/>
<Stack.Screen name="modal" options={{ presentation: 'modal' }} />
</Stack>
);
}