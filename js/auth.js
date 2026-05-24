// KPSS Platformu: Firebase Dinamik Kimlik Doğrulama Modülü

export const AuthManager = {
  app: null,
  auth: null,
  user: null,
  isFirebaseActive: false,
  onStateChangeCallbacks: [],

  // Initialize and check if Firebase config is stored
  async init() {
    let config = localStorage.getItem('kpss_firebase_config');
    let parsedConfig;
    if (!config) {
      console.log("No custom Firebase config found. Using default default app configuration.");
      parsedConfig = {
        apiKey: "AIzaSyCrN4SD-KT-oEd15g_idUuaplgW-mXfMDw",
        authDomain: "kpss-puan-takip.firebaseapp.com",
        projectId: "kpss-puan-takip",
        storageBucket: "kpss-puan-takip.firebasestorage.app",
        messagingSenderId: "195919924474",
        appId: "1:195919924474:web:83950ed25c28a1b09c0d43",
        measurementId: "G-FD7C1R8V8G"
      };
    } else {
      parsedConfig = JSON.parse(config);
    }

    try {
      // Dynamic imports from Google's modular Firebase CDN
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
      const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');

      this.app = initializeApp(parsedConfig);
      this.auth = getAuth(this.app);
      this.isFirebaseActive = true;

      // Register Auth state listener
      onAuthStateChanged(this.auth, (user) => {
        this.user = user;
        this.triggerStateChange(user);
      });

      // Bind authentication action methods
      this.signIn = async (email, password) => {
        return signInWithEmailAndPassword(this.auth, email, password);
      };

      this.signUp = async (email, password) => {
        return createUserWithEmailAndPassword(this.auth, email, password);
      };

      this.logOut = async () => {
        return signOut(this.auth);
      };

      this.signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(this.auth, provider);
      };

      return true;
    } catch (error) {
      console.error("Firebase Auth initialisation failed. Falling back to LocalStorage.", error);
      this.isFirebaseActive = false;
      this.triggerStateChange(null);
      return false;
    }
  },

  // State Change registration
  onAuthStateChanged(callback) {
    this.onStateChangeCallbacks.push(callback);
    // Execute immediately with current state
    callback(this.user, this.isFirebaseActive);
  },

  triggerStateChange(user) {
    this.onStateChangeCallbacks.forEach(cb => cb(user, this.isFirebaseActive));
  },

  // Save Config to storage & connect
  async saveConfigAndConnect(configObj) {
    try {
      localStorage.setItem('kpss_firebase_config', JSON.stringify(configObj));
      // Re-init
      const success = await this.init();
      if (!success) {
        localStorage.removeItem('kpss_firebase_config');
        throw new Error("Initialization with provided configuration failed.");
      }
      return true;
    } catch (err) {
      localStorage.removeItem('kpss_firebase_config');
      throw err;
    }
  },

  // Disconnect Firebase completely
  disconnect() {
    localStorage.removeItem('kpss_firebase_config');
    this.app = null;
    this.auth = null;
    this.user = null;
    this.isFirebaseActive = false;
    this.triggerStateChange(null);
  }
};
