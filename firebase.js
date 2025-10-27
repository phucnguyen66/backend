// firebase.js (CommonJS version for Node backend)

const { initializeApp } = require("firebase/app");
const { getDatabase } = require("firebase/database");
const { getAuth } = require("firebase/auth");

// ⚙️ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB8w6uuHq5SayLldN6Cvvd2b5pej6-NmOo",
  authDomain: "doantotnghiep-16216.firebaseapp.com",
  databaseURL: "https://doantotnghiep-16216-default-rtdb.firebaseio.com",
  projectId: "doantotnghiep-16216",
  storageBucket: "doantotnghiep-16216.firebasestorage.app",
  messagingSenderId: "829506657932",
  appId: "1:829506657932:web:235e85e63ff34b4104e5a9",
  measurementId: "G-2ZXMX8FGNZ",
};

// 🚀 Initialize Firebase
const app = initializeApp(firebaseConfig);

// 💾 Initialize Realtime Database
const db = getDatabase(app);

// 👤 Initialize Auth (optional, nếu backend cần xác thực)
const auth = getAuth(app);

// ✅ Export cho các server khác dùng
module.exports = { db, auth };
