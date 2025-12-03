import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBC_KFdqG1O9LvjRm-VUqSagEzBnh69oWg",
  authDomain: "rozgarconnect-95ea4.firebaseapp.com",
  projectId: "rozgarconnect-95ea4",
  storageBucket: "rozgarconnect-95ea4.firebasestorage.app",
  messagingSenderId: "160941325237",
  appId: "1:160941325237:web:1c1254ecb1623d6c9937fc" // Use web appId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);