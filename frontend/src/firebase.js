import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDvdFIIcHMctL0BDDr48Xr4WWs_UbYzFkk",
    authDomain: "accisafe-305ed.firebaseapp.com",
    projectId: "accisafe-305ed",
    storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
    messagingSenderId: "455217267041",
    appId: "1:455217267041:web:d52f325f4ec96e45dc8520"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);