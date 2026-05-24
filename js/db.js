// KPSS Platformu: Çevrimdışı Öncelikli Firestore & LocalStorage Veritabanı Modülü

import { AuthManager } from './auth.js';

export const DbManager = {
  db: null,
  isFirebaseActive: false,
  currentUser: null,

  async init() {
    AuthManager.onAuthStateChanged(async (user, active) => {
      this.currentUser = user;
      this.isFirebaseActive = active;

      if (active && user) {
        try {
          const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
          this.db = getFirestore(AuthManager.app);
        } catch (err) {
          console.error("Firestore initialization failed:", err);
          this.db = null;
        }
      } else {
        this.db = null;
      }
    });
  },

  // GET ALL TRIALS
  async getTrials() {
    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const q = query(collection(this.db, 'users', this.currentUser.uid, 'trials'), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const trials = [];
        querySnapshot.forEach((doc) => {
          trials.push({ id: doc.id, ...doc.data() });
        });
        // Cache to local storage as backup
        localStorage.setItem('kpss_cached_trials', JSON.stringify(trials));
        return trials;
      } catch (err) {
        console.error("Firestore getTrials failed, loading from local cache:", err);
        return this.getLocalTrials();
      }
    } else {
      return this.getLocalTrials();
    }
  },

  getLocalTrials() {
    const trials = localStorage.getItem('kpss_cached_trials');
    return trials ? JSON.parse(trials) : [];
  },

  // SAVE TRIAL
  async saveTrial(trial) {
    const localTrials = this.getLocalTrials();
    localTrials.unshift(trial); // Add to beginning
    localStorage.setItem('kpss_cached_trials', JSON.stringify(localTrials));

    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const trialDocRef = doc(this.db, 'users', this.currentUser.uid, 'trials', trial.id);
        await setDoc(trialDocRef, trial);
      } catch (err) {
        console.error("Firestore saveTrial failed, saved locally:", err);
      }
    }
    return localTrials;
  },

  // DELETE TRIAL
  async deleteTrial(trialId) {
    const localTrials = this.getLocalTrials();
    const filtered = localTrials.filter(t => t.id !== trialId);
    localStorage.setItem('kpss_cached_trials', JSON.stringify(filtered));

    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const trialDocRef = doc(this.db, 'users', this.currentUser.uid, 'trials', trialId);
        await deleteDoc(trialDocRef);
      } catch (err) {
        console.error("Firestore deleteTrial failed, deleted locally:", err);
      }
    }
    return filtered;
  },

  // GET BRANCH TRIALS
  async getBranchTrials() {
    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const q = query(collection(this.db, 'users', this.currentUser.uid, 'branchTrials'), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const bTrials = [];
        querySnapshot.forEach((doc) => {
          bTrials.push({ id: doc.id, ...doc.data() });
        });
        localStorage.setItem('kpss_cached_btrials', JSON.stringify(bTrials));
        return bTrials;
      } catch (err) {
        console.error("Firestore getBranchTrials failed, loading from local cache:", err);
        return this.getLocalBranchTrials();
      }
    } else {
      return this.getLocalBranchTrials();
    }
  },

  getLocalBranchTrials() {
    const bTrials = localStorage.getItem('kpss_cached_btrials');
    return bTrials ? JSON.parse(bTrials) : [];
  },

  // SAVE BRANCH TRIAL
  async saveBranchTrial(bTrial) {
    const localBranchTrials = this.getLocalBranchTrials();
    localBranchTrials.unshift(bTrial);
    localStorage.setItem('kpss_cached_btrials', JSON.stringify(localBranchTrials));

    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const bTrialDocRef = doc(this.db, 'users', this.currentUser.uid, 'branchTrials', bTrial.id);
        await setDoc(bTrialDocRef, bTrial);
      } catch (err) {
        console.error("Firestore saveBranchTrial failed, saved locally:", err);
      }
    }
    return localBranchTrials;
  },

  // DELETE BRANCH TRIAL
  async deleteBranchTrial(bTrialId) {
    const localBranchTrials = this.getLocalBranchTrials();
    const filtered = localBranchTrials.filter(t => t.id !== bTrialId);
    localStorage.setItem('kpss_cached_btrials', JSON.stringify(filtered));

    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const bTrialDocRef = doc(this.db, 'users', this.currentUser.uid, 'branchTrials', bTrialId);
        await deleteDoc(bTrialDocRef);
      } catch (err) {
        console.error("Firestore deleteBranchTrial failed, deleted locally:", err);
      }
    }
    return filtered;
  },

  // CUSTOM BRANCHES
  async getCustomBranches() {
    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const userDocRef = doc(this.db, 'users', this.currentUser.uid);
        const snapshot = await getDoc(userDocRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.customBranches) {
            localStorage.setItem('kpss_custom_branches', JSON.stringify(data.customBranches));
            return data.customBranches;
          }
        }
      } catch (err) {
        console.error("Firestore getCustomBranches failed, using cache:", err);
      }
    }
    const local = localStorage.getItem('kpss_custom_branches');
    return local ? JSON.parse(local) : [];
  },

  async saveCustomBranch(branchName) {
    const localBranches = await this.getCustomBranches();
    if (!localBranches.includes(branchName)) {
      localBranches.push(branchName);
      localStorage.setItem('kpss_custom_branches', JSON.stringify(localBranches));

      if (this.isFirebaseActive && this.currentUser && this.db) {
        try {
          const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
          const userDocRef = doc(this.db, 'users', this.currentUser.uid);
          await setDoc(userDocRef, { customBranches: localBranches }, { merge: true });
        } catch (err) {
          console.error("Firestore saveCustomBranch failed, saved locally:", err);
        }
      }
    }
    return localBranches;
  },

  // FORMULA COEFFICIENTS
  async getFormulaSettings() {
    const defaultSettings = {
      lisans: { base: 38.5, gy: 0.495, gk: 0.495 },
      onlisans: { base: 37.8, gy: 0.505, gk: 0.505 },
      ortaogretim: { base: 36.5, gy: 0.515, gk: 0.515 }
    };

    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const docRef = doc(this.db, 'users', this.currentUser.uid, 'settings', 'formula');
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          localStorage.setItem('kpss_formula_settings', JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.error("Firestore getFormulaSettings failed, using cached settings:", err);
      }
    }

    const cached = localStorage.getItem('kpss_formula_settings');
    return cached ? JSON.parse(cached) : defaultSettings;
  },

  async saveFormulaSettings(settings) {
    localStorage.setItem('kpss_formula_settings', JSON.stringify(settings));

    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const docRef = doc(this.db, 'users', this.currentUser.uid, 'settings', 'formula');
        await setDoc(docRef, settings);
      } catch (err) {
        console.error("Firestore saveFormulaSettings failed, saved locally:", err);
      }
    }
  },

  // SYNC ALL LOCAL TO FIRESTORE
  async syncLocalToCloud() {
    if (!this.isFirebaseActive || !this.currentUser || !this.db) return false;

    try {
      const { doc, setDoc, writeBatch, collection } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const batch = writeBatch(this.db);

      // Sync Trials
      const localTrials = this.getLocalTrials();
      for (const trial of localTrials) {
        const tRef = doc(this.db, 'users', this.currentUser.uid, 'trials', trial.id);
        batch.set(tRef, trial);
      }

      // Sync Branch Trials
      const localBTrials = this.getLocalBranchTrials();
      for (const bt of localBTrials) {
        const btRef = doc(this.db, 'users', this.currentUser.uid, 'branchTrials', bt.id);
        batch.set(btRef, bt);
      }

      // Sync Custom Branches
      const branches = await this.getCustomBranches();
      const userRef = doc(this.db, 'users', this.currentUser.uid);
      batch.set(userRef, { customBranches: branches }, { merge: true });

      // Sync Formula Settings
      const cachedFormula = localStorage.getItem('kpss_formula_settings');
      if (cachedFormula) {
        const fRef = doc(this.db, 'users', this.currentUser.uid, 'settings', 'formula');
        batch.set(fRef, JSON.parse(cachedFormula));
      }

      await batch.commit();
      console.log("Local storage synchronized with Cloud Firestore successfully!");
      return true;
    } catch (err) {
      console.error("Data synchronization failed:", err);
      return false;
    }
  },

  // WIPE ALL DATA
  async wipeAllData() {
    localStorage.removeItem('kpss_cached_trials');
    localStorage.removeItem('kpss_cached_btrials');
    localStorage.removeItem('kpss_custom_branches');
    localStorage.removeItem('kpss_formula_settings');

    if (this.isFirebaseActive && this.currentUser && this.db) {
      try {
        const { doc, deleteDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        
        // Delete trials from cloud
        const trialsSnapshot = await getDocs(collection(this.db, 'users', this.currentUser.uid, 'trials'));
        for (const d of trialsSnapshot.docs) {
          await deleteDoc(doc(this.db, 'users', this.currentUser.uid, 'trials', d.id));
        }

        // Delete branch trials from cloud
        const bTrialsSnapshot = await getDocs(collection(this.db, 'users', this.currentUser.uid, 'branchTrials'));
        for (const d of bTrialsSnapshot.docs) {
          await deleteDoc(doc(this.db, 'users', this.currentUser.uid, 'branchTrials', d.id));
        }

        // Delete settings
        await deleteDoc(doc(this.db, 'users', this.currentUser.uid, 'settings', 'formula'));
        await deleteDoc(doc(this.db, 'users', this.currentUser.uid));
      } catch (err) {
        console.error("Firestore cloud wipe failed:", err);
      }
    }
    return true;
  }
};
