import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCPbfqXigdC1Z3GD8AuGYJv2OqkXkPXCLw",
  authDomain: "end-term-870b4.firebaseapp.com",
  projectId: "end-term-870b4",
  storageBucket: "end-term-870b4.firebasestorage.app",
  messagingSenderId: "207800695694",
  appId: "1:207800695694:web:ed42babcd90a005d3582df",
  measurementId: "G-MF8LZQQ3C2",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
