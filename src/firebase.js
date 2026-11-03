
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCAPUTWcqQrEpBVyNsAl3zSZIpJwws1gF0",
  authDomain: "findit-d108c.firebaseapp.com",
  projectId: "findit-d108c",
  storageBucket: "findit-d108c.firebasestorage.app",
  messagingSenderId: "527910814086",
  appId: "1:527910814086:web:48e801474cf1d43ed32c07"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
