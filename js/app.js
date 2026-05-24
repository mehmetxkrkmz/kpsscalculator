// KPSS Platformu: Ana Uygulama Koordinatörü (State Machine & UI Controller)

import { AuthManager } from './auth.js';
import { DbManager } from './db.js';
import { ChartManager } from './charts.js';

// Global application state
const AppState = {
  examType: 'lisans', // 'lisans' | 'onlisans' | 'ortaogretim' | 'ogretmenlik' | 'dhbt'
  entryMode: 'summary', // 'summary' | 'detailed'
  coefficients: null,
  activeYear: '2024',
  oabtField: 'none',
  dhbtLevel: 'lisans',
  
  trials: [],
  branchTrials: [],
  customBranches: [],
  activeTab: 'home',
  
  timerInterval: null,
  timerSeconds: 0,
  timerIsRunning: false,
  focusSessionsCount: 0
};

// OABT Alan isimleri mapping
const OABT_FIELDS = {
  "1": "Türkçe",
  "2": "Matematik (İlköğretim)",
  "3": "Fen Bilimleri/Fen ve Teknoloji",
  "4": "Sosyal Bilgiler",
  "5": "Türk Dili ve Edebiyatı",
  "6": "Tarih",
  "7": "Coğrafya",
  "8": "Matematik (Lise)",
  "9": "Fizik",
  "10": "Kimya/Kimya Teknolojisi",
  "11": "Biyoloji",
  "12": "Din Kültürü ve Ahlak Bilgisi",
  "13": "İngilizce",
  "14": "Rehberlik",
  "15": "Sınıf Öğretmenliği",
  "16": "Okul Öncesi",
  "17": "Beden Eğitimi",
  "18": "İmam-Hatip Lisesi Meslek Dersleri"
};

window.App = {
  async init() {
    console.log("KPSS Performance App initializing...");
    await AuthManager.init();
    await DbManager.init();
    
    const storedSessions = localStorage.getItem('kpss_focus_sessions');
    AppState.focusSessionsCount = storedSessions ? parseInt(storedSessions) : 0;
    
    try {
      const res = await fetch('js/coefficients.json');
      AppState.coefficients = await res.json();
      this.fixCoefficients(AppState.coefficients);
    } catch(e) {
      console.error("Coefficients load error:", e);
    }

    this.setupListeners();
    this.runOpeningSequence();
    
    AuthManager.onAuthStateChanged((user, active) => {
      this.handleAuthStateChange(user, active);
    });

    this.changeExamType('lisans');
  },

  runOpeningSequence() {
    this.typeSignature('splash-signature', 'MEHMET KORKMAZ', 100);
    setTimeout(() => {
      const splash = document.getElementById('splash-screen');
      if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => {
          this.typeSignature('footer-signature', 'MEHMET KORKMAZ', 120);
        }, 600);
      }
      this.createStars();
    }, 2600);
  },

  typeSignature(elementId, text, speed = 80) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';
    const letters = text.split('');
    letters.forEach((char, idx) => {
      const span = document.createElement('span');
      span.className = 'signature-letter';
      if (elementId === 'footer-signature') {
         span.style.color = 'inherit';
      }
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.style.animationDelay = `${idx * speed}ms`;
      container.appendChild(span);
      
      if (elementId === 'footer-signature') {
          setTimeout(() => {
              span.style.opacity = '1';
              span.style.animation = 'wave-glow 3s infinite ease-in-out';
              span.style.animationDelay = `${idx * 150}ms`;
          }, text.length * speed + 500);
      }
    });
  },

  createStars() {
    const container = document.getElementById('stars-container');
    if (!container) return;
    container.innerHTML = '';
    for(let i=0; i<25; i++) {
       let star = document.createElement('div');
       star.className = 'shooting-star';
       star.style.top = Math.random() * 100 + 'vh';
       star.style.left = Math.random() * 100 + 'vw';
       star.style.animationDuration = (Math.random() * 3 + 2) + 's';
       star.style.animationDelay = (Math.random() * 5) + 's';
       container.appendChild(star);
    }
  },

  async handleAuthStateChange(user, active) {
    const nameDisplay = document.getElementById('user-name-display');
    const avatar = document.getElementById('user-avatar');
    const dStatus = document.getElementById('dropdown-status-text');
    const dGuest = document.getElementById('dropdown-guest-menu');
    const dUser = document.getElementById('dropdown-user-menu');
    const dEmail = document.getElementById('dropdown-user-email');
    const btnReset = document.getElementById('btn-firebase-reset');

    if (active) {
      btnReset.classList.remove('hidden');
    } else {
      btnReset.classList.add('hidden');
    }

    if (user) {
      const email = user.email;
      nameDisplay.textContent = email.split('@')[0];
      avatar.textContent = email.charAt(0).toUpperCase();
      avatar.className = "w-6 h-6 rounded-full bg-emeraldNeon flex items-center justify-center text-xs font-bold text-cyberDark border border-emeraldNeon/20";
      dStatus.innerHTML = '<span class="text-emeraldNeon">OTURUM AÇIK</span>';
      dEmail.textContent = email;
      dGuest.classList.add('hidden');
      dUser.classList.remove('hidden');
    } else {
      nameDisplay.textContent = active ? 'Bağlantı Var' : 'Guest / Yerel';
      avatar.textContent = active ? 'B' : 'G';
      avatar.className = "w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-emeraldNeon border border-emeraldNeon/20";
      dStatus.innerHTML = active 
        ? '<span class="text-emeraldNeon">Giriş Bekleniyor</span>' 
        : '<span class="text-slate-500">Yerel Mod</span>';
      dGuest.classList.remove('hidden');
      dUser.classList.add('hidden');
    }

    await this.loadAndRefreshAll();
  },

  async loadAndRefreshAll() {
    AppState.trials = await DbManager.getTrials();
    AppState.branchTrials = await DbManager.getBranchTrials();
    AppState.customBranches = await DbManager.getCustomBranches();
    
    this.rebuildBranchSelectors();
    this.calculateOverallStats();
    
    // Auto calculate if there are inputs, or just leave empty
    if(this.hasAnyInput()) {
      this.onScoreChange();
    }
    
    ChartManager.renderGeneralChart('general-progress-chart', AppState.trials);
    const activeBranch = document.getElementById('graph-branch-select').value;
    ChartManager.renderBranchChart('branch-progress-chart', AppState.branchTrials, activeBranch);
  },

  hasAnyInput() {
    let hasVal = false;
    document.querySelectorAll('#puan-form input[type="number"]').forEach(el => {
      if(el.value && parseFloat(el.value) > 0) hasVal = true;
    });
    return hasVal;
  },

  setupListeners() {
    document.getElementById('tab-btn-home').addEventListener('click', () => this.switchTab('home'));
    document.getElementById('tab-btn-profile').addEventListener('click', () => this.switchTab('profile'));

    const btnDropdown = document.getElementById('btn-profile-dropdown');
    document.addEventListener('click', (e) => {
      const dd = document.getElementById('profile-dropdown');
      if (btnDropdown.contains(e.target)) {
        dd.classList.toggle('hidden');
      } else if (dd && !dd.contains(e.target)) {
        dd.classList.add('hidden');
      }
    });

    document.getElementById('btn-open-settings').addEventListener('click', () => {
      const config = localStorage.getItem('kpss_firebase_config');
      if (config) {
        document.getElementById('firebase-config-json').value = JSON.stringify(JSON.parse(config), null, 2);
      } else {
        document.getElementById('firebase-config-json').value = '';
      }
      document.getElementById('modal-settings').classList.remove('hidden');
    });

    document.getElementById('btn-open-login').addEventListener('click', () => {
      document.getElementById('modal-auth').classList.remove('hidden');
    });

    const btnSync = document.getElementById('btn-sync-now');
    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        const syncIcon = document.getElementById('sync-icon');
        syncIcon.classList.add('fa-spin');
        const success = await DbManager.syncLocalToCloud();
        syncIcon.classList.remove('fa-spin');
        if (success) {
          alert("Senkronizasyon başarılı!");
          await this.loadAndRefreshAll();
        } else {
          alert("Senkronizasyon hatası!");
        }
      });
    }

    document.getElementById('btn-focus-trigger').addEventListener('click', () => this.openFocusOverlay());
    document.getElementById('btn-timer-toggle').addEventListener('click', () => this.toggleStopwatch());
    document.getElementById('btn-timer-exit').addEventListener('click', () => this.closeFocusOverlay());
  },

  fixCoefficients(db) {
    if (db.lisans) {
      Object.values(db.lisans).forEach(yearData => {
        Object.values(yearData).forEach(c => {
          c.gy = c.gy / 10.0;
          c.gk = c.gk / 10.0;
          c.base = c.base + 90 * c.gy + 90 * c.gk;
        });
      });
    }
    ['onlisans', 'ortaogretim'].forEach(type => {
      if (db[type]) {
        // If 2024 is missing but 2022 exists, duplicate it so UI shows 2024
        if (!db[type]['2024'] && db[type]['2022']) {
             db[type]['2024'] = JSON.parse(JSON.stringify(db[type]['2022']));
        }
        Object.values(db[type]).forEach(c => {
          c.gy = c.gy / 10.0;
          c.gk = c.gk / 10.0;
          c.base = c.base + 90 * c.gy + 90 * c.gk;
        });
      }
    });
    if (db.egitim) {
      Object.values(db.egitim).forEach(yearData => {
        Object.values(yearData).forEach(c => {
          c.gy = c.gy / 10.0;
          c.gk = c.gk / 10.0;
          c.base = c.base + 90 * c.gy + 90 * c.gk;
        });
      });
    }
    if (db.dhbt) {
      Object.values(db.dhbt).forEach(yearData => {
        Object.values(yearData).forEach(c => {
          c.gy = c.gy / 10.0;
          c.gk = c.gk / 10.0;
          c.base = c.base + 90 * c.gy + 90 * c.gk;
        });
      });
    }
    if (db.oabt) {
      Object.values(db.oabt).forEach(yearData => {
        Object.values(yearData).forEach(c => {
          c.gy = c.gy / 10.0;
          c.gk = c.gk / 10.0;
          c.base = c.base + 90 * c.gy + 90 * c.gk;
        });
      });
    }
  },

  switchTab(tabName) {
    AppState.activeTab = tabName;
    document.querySelectorAll('.custom-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

    if (tabName === 'home') {
      document.getElementById('tab-btn-home').classList.add('active');
      document.getElementById('tab-home').classList.add('active');
    } else {
      document.getElementById('tab-btn-profile').classList.add('active');
      document.getElementById('tab-profile').classList.add('active');
      setTimeout(() => {
        ChartManager.renderGeneralChart('general-progress-chart', AppState.trials);
        const activeBranch = document.getElementById('graph-branch-select').value;
        ChartManager.renderBranchChart('branch-progress-chart', AppState.branchTrials, activeBranch);
      }, 50);
    }
  },

  // UI STATE MANAGEMENT
  changeExamType(type) {
    AppState.examType = type;
    
    const tabs = ['lisans', 'ogretmenlik', 'onlisans', 'ortaogretim', 'dhbt'];
    tabs.forEach(t => {
      const btn = document.getElementById(`exam-tab-${t}`);
      if(btn) btn.className = "flex-1 min-w-[120px] text-center py-2 text-[10px] sm:text-xs font-bold tracking-wider uppercase rounded-lg text-slate-400 hover:text-slate-200 transition-all duration-300";
    });
    const activeBtn = document.getElementById(`exam-tab-${type}`);
    if(activeBtn) activeBtn.className = "flex-1 min-w-[120px] text-center py-2 text-[10px] sm:text-xs font-bold tracking-wider uppercase rounded-lg bg-emeraldNeon text-cyberDark glow-emerald transition-all duration-300";
    
    const oabtContainer = document.getElementById('oabt-field-container');
    const dhbtContainer = document.getElementById('dhbt-level-container');
    const colEB = document.getElementById('col-eb');
    const colOABT = document.getElementById('col-oabt');
    const colDHBT = document.getElementById('col-dhbt');
    
    oabtContainer.classList.add('hidden');
    dhbtContainer.classList.add('hidden');
    colEB.classList.add('hidden');
    colOABT.classList.add('hidden');
    colDHBT.classList.add('hidden');
    
    if (type === 'ogretmenlik') {
      oabtContainer.classList.remove('hidden');
      colEB.classList.remove('hidden');
      this.populateOABTFields();
    } else if (type === 'dhbt') {
      dhbtContainer.classList.remove('hidden');
      colDHBT.classList.remove('hidden');
    }
    
    this.updateUI();
  },
  
  populateOABTFields() {
    const sel = document.getElementById('oabt-field-select');
    sel.innerHTML = '<option value="none">Sadece Eğitim Bilimleri (P10) - ÖABT Yok</option>';
    
    if (AppState.coefficients && AppState.coefficients.oabt && AppState.coefficients.oabt['2024']) {
        const fields = AppState.coefficients.oabt['2024'];
        Object.keys(fields).forEach(id => {
            const name = OABT_FIELDS[id] || `Alan ${id}`;
            sel.add(new Option(name, id));
        });
    }
    sel.value = 'none';
  },

  getInputValue(id) {
    const el = document.getElementById(id);
    if(!el) return 0;
    const val = parseFloat(el.value);
    return isNaN(val) ? 0 : Math.max(0, val);
  },

  changeEntryMode(mode) {
    AppState.entryMode = mode;
    const btnSummary = document.getElementById('btn-entry-summary');
    const btnDetailed = document.getElementById('btn-entry-detailed');
    const summaryFields = document.getElementById('summary-entry-fields');
    const detailedFields = document.getElementById('detailed-entry-fields');

    if (mode === 'summary') {
      btnSummary.className = "px-3 py-1 text-[10px] font-bold rounded bg-emeraldNeon text-cyberDark glow-emerald";
      btnDetailed.className = "px-3 py-1 text-[10px] font-bold rounded text-slate-400 hover:text-slate-200";
      summaryFields.classList.remove('hidden');
      detailedFields.classList.add('hidden');
    } else {
      btnDetailed.className = "px-3 py-1 text-[10px] font-bold rounded bg-emeraldNeon text-cyberDark glow-emerald";
      btnSummary.className = "px-3 py-1 text-[10px] font-bold rounded text-slate-400 hover:text-slate-200";
      detailedFields.classList.remove('hidden');
      summaryFields.classList.add('hidden');
    }
  },

  updateUI() {
    AppState.oabtField = document.getElementById('oabt-field-select').value || 'none';
    AppState.dhbtLevel = document.getElementById('dhbt-level-select').value || 'lisans';
    
    if (AppState.examType === 'ogretmenlik') {
      if (AppState.oabtField !== 'none') {
        document.getElementById('col-oabt').classList.remove('hidden');
        document.getElementById('oabt-title').textContent = OABT_FIELDS[AppState.oabtField];
      } else {
        document.getElementById('col-oabt').classList.add('hidden');
      }
    }
  },

  // CALCULATION LOGIC
  onScoreChange() {
    if (!AppState.coefficients) {
       alert("Katsayılar yüklenemedi. Sayfayı yenileyin.");
       return;
    }
    
    this.updateUI();

    let gy_net = 0, gk_net = 0, eb_net = 0, oabt_net = 0, dhbt1_net = 0, dhbt2_net = 0;

    if (AppState.entryMode === 'summary') {
      gy_net = this.getInputValue('sum-gy-d') - (this.getInputValue('sum-gy-y') / 4);
      gk_net = this.getInputValue('sum-gk-d') - (this.getInputValue('sum-gk-y') / 4);
    } else {
      gy_net = (this.getInputValue('gy-tr-d') - this.getInputValue('gy-tr-y')/4) + (this.getInputValue('gy-mat-d') - this.getInputValue('gy-mat-y')/4);
      gk_net = (this.getInputValue('gk-tar-d') - this.getInputValue('gk-tar-y')/4) + (this.getInputValue('gk-cog-d') - this.getInputValue('gk-cog-y')/4) + (this.getInputValue('gk-vat-d') - this.getInputValue('gk-vat-y')/4);
    }
    
    eb_net = this.getInputValue('eb-d') - (this.getInputValue('eb-y') / 4);
    oabt_net = this.getInputValue('oabt-d') - (this.getInputValue('oabt-y') / 4);
    dhbt1_net = this.getInputValue('dhbt1-d') - (this.getInputValue('dhbt1-y') / 4);
    dhbt2_net = this.getInputValue('dhbt2-d') - (this.getInputValue('dhbt2-y') / 4);

    const total_net = gy_net + gk_net + (AppState.examType === 'ogretmenlik' ? eb_net + oabt_net : 0) + (AppState.examType === 'dhbt' ? dhbt1_net + dhbt2_net : 0);
    
    // Fetch target years available
    let targetYears = [];
    if (AppState.examType === 'lisans' || AppState.examType === 'ogretmenlik') {
      targetYears = Object.keys(AppState.coefficients.lisans).sort().reverse();
    } else if (AppState.examType === 'dhbt') {
      targetYears = ['2024', '2022', '2020', '2018', '2016', '2014']; // Valid DHBT years
    } else {
      targetYears = Object.keys(AppState.coefficients[AppState.examType] || {}).sort().reverse();
    }

    const resultsByYear = {};

    targetYears.forEach(year => {
        let yearResults = [];

        // Lisans
        if (AppState.examType === 'lisans' || AppState.examType === 'ogretmenlik' || AppState.dhbtLevel === 'lisans') {
            const c = AppState.coefficients.lisans[year];
            if (c) {
                let p1 = c.KPSSP1.base + (gy_net * c.KPSSP1.gy) + (gk_net * c.KPSSP1.gk);
                let p2 = c.KPSSP2.base + (gy_net * c.KPSSP2.gy) + (gk_net * c.KPSSP2.gk);
                let p3 = c.KPSSP3.base + (gy_net * c.KPSSP3.gy) + (gk_net * c.KPSSP3.gk);
                
                p1 = (gy_net+gk_net > 0) ? Math.min(100, Math.max(0, p1)) : c.KPSSP1.base;
                p2 = (gy_net+gk_net > 0) ? Math.min(100, Math.max(0, p2)) : c.KPSSP2.base;
                p3 = (gy_net+gk_net > 0) ? Math.min(100, Math.max(0, p3)) : c.KPSSP3.base;
                
                yearResults.push({ name: 'P1', score: p1.toFixed(5), isMain: false });
                yearResults.push({ name: 'P2', score: p2.toFixed(5), isMain: false });
                yearResults.push({ name: 'P3', score: p3.toFixed(5), isMain: AppState.examType === 'lisans' });
            }
        }
        
        // Onlisans
        if (AppState.examType === 'onlisans' || AppState.dhbtLevel === 'onlisans') {
            const c = AppState.coefficients.onlisans[year];
            if (c) {
                let p93 = c.base + (gy_net * c.gy) + (gk_net * c.gk);
                p93 = (gy_net+gk_net > 0) ? Math.min(100, Math.max(0, p93)) : c.base;
                yearResults.push({ name: 'P93', score: p93.toFixed(5), isMain: AppState.examType === 'onlisans' });
            }
        }

        // Ortaogretim
        if (AppState.examType === 'ortaogretim' || AppState.dhbtLevel === 'ortaogretim') {
            const c = AppState.coefficients.ortaogretim[year];
            if (c) {
                let p94 = c.base + (gy_net * c.gy) + (gk_net * c.gk);
                p94 = (gy_net+gk_net > 0) ? Math.min(100, Math.max(0, p94)) : c.base;
                yearResults.push({ name: 'P94', score: p94.toFixed(5), isMain: AppState.examType === 'ortaogretim' });
            }
        }

        // Eğitim
        if (AppState.examType === 'ogretmenlik') {
            const c_eb = AppState.coefficients.egitim[year]?.KPSSP10;
            if (c_eb) {
                let p10 = c_eb.base + (gy_net * c_eb.gy) + (gk_net * c_eb.gk) + (eb_net * c_eb.eb);
                p10 = (total_net > 0) ? Math.min(100, Math.max(0, p10)) : c_eb.base;
                yearResults.push({ name: 'P10', score: p10.toFixed(5), isMain: AppState.oabtField === 'none' });
            }
            
            if (AppState.oabtField !== 'none') {
                const c_oabt = AppState.coefficients.oabt[year]?.[AppState.oabtField];
                if (c_oabt) {
                    let p121 = c_oabt.base + (gy_net * c_oabt.gy) + (gk_net * c_oabt.gk) + (eb_net * c_oabt.eb) + (oabt_net * c_oabt.oabt);
                    p121 = (total_net > 0) ? Math.min(100, Math.max(0, p121)) : c_oabt.base;
                    yearResults.push({ name: 'P121', score: p121.toFixed(5), isMain: true });
                }
            }
        }
        
        // DHBT
        if (AppState.examType === 'dhbt') {
            const pType = AppState.dhbtLevel === 'ortaogretim' ? 'P122' : (AppState.dhbtLevel === 'onlisans' ? 'P123' : 'P124');
            const c = AppState.coefficients.dhbt?.[year]?.[`KPSS${pType}`];
            if (c) {
                let p_dhbt = c.base + (gy_net * c.gy) + (gk_net * c.gk) + (dhbt1_net * c.dhbt1) + (dhbt2_net * c.dhbt2);
                p_dhbt = (total_net > 0) ? Math.min(100, Math.max(0, p_dhbt)) : c.base;
                yearResults.push({ name: pType, score: p_dhbt.toFixed(5), isMain: true });
            }
        }

        if (yearResults.length > 0) {
            resultsByYear[year] = yearResults;
        }
    });

    this.renderTableResults(resultsByYear);
  },

  renderTableResults(resultsByYear) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';
    
    const years = Object.keys(resultsByYear).sort().reverse();
    if (years.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-500 text-xs">Bu sınav türü için hesaplanacak veri bulunamadı.</div>';
        return;
    }

    const cols = resultsByYear[years[0]].map(r => r.name);
    
    let html = `
    <div class="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-2xl">
      <table class="w-full text-left text-xs text-slate-300">
        <thead class="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400">
          <tr>
            <th class="px-4 py-3 border-b border-slate-800 w-24">SINAV YILI</th>
            ${cols.map(c => `<th class="px-4 py-3 border-b border-slate-800 text-right tracking-wider">${c}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/50 font-mono">
    `;

    years.forEach((year, idx) => {
        const isCurrent = idx === 0; // Most recent year
        const rowClass = isCurrent ? 'bg-emeraldNeon/10 glow-emerald/10' : 'hover:bg-slate-800/30 transition-colors';
        html += `<tr class="${rowClass}">
            <td class="px-4 py-3 font-bold ${isCurrent ? 'text-emeraldNeon' : 'text-slate-200'}">${year}</td>`;
        
        resultsByYear[year].forEach(res => {
            const color = res.isMain ? (isCurrent ? 'text-emeraldNeon font-bold text-sm' : 'text-slate-200 font-bold') : 'text-slate-400';
            const dataScoreAttr = res.isMain && isCurrent ? `data-score="${res.score}"` : '';
            html += `<td class="px-4 py-3 text-right ${color} tracking-tight" ${dataScoreAttr}>${res.score}</td>`;
        });
        html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    </div>
    `;

    container.innerHTML = html;
    
    // Save state for saving the trial (defaults to the most recent year)
    AppState.activeYear = years[0]; 
  },

  async saveGeneralTrial() {
    let gy_net = 0, gk_net = 0, eb_net = 0, oabt_net = 0, dhbt1_net = 0, dhbt2_net = 0;
    
    if (AppState.entryMode === 'summary') {
      gy_net = this.getInputValue('sum-gy-d') - (this.getInputValue('sum-gy-y') / 4);
      gk_net = this.getInputValue('sum-gk-d') - (this.getInputValue('sum-gk-y') / 4);
    } else {
      gy_net = (this.getInputValue('gy-tr-d') - this.getInputValue('gy-tr-y')/4) + (this.getInputValue('gy-mat-d') - this.getInputValue('gy-mat-y')/4);
      gk_net = (this.getInputValue('gk-tar-d') - this.getInputValue('gk-tar-y')/4) + (this.getInputValue('gk-cog-d') - this.getInputValue('gk-cog-y')/4) + (this.getInputValue('gk-vat-d') - this.getInputValue('gk-vat-y')/4);
    }
    
    eb_net = this.getInputValue('eb-d') - (this.getInputValue('eb-y') / 4);
    oabt_net = this.getInputValue('oabt-d') - (this.getInputValue('oabt-y') / 4);
    dhbt1_net = this.getInputValue('dhbt1-d') - (this.getInputValue('dhbt1-y') / 4);
    dhbt2_net = this.getInputValue('dhbt2-d') - (this.getInputValue('dhbt2-y') / 4);

    const total_net = gy_net + gk_net + eb_net + oabt_net + dhbt1_net + dhbt2_net;

    if (total_net === 0) {
      alert("Lütfen denemeyi kaydetmeden önce net değeri oluşturacak doğru veya yanlış girişleri yapın.");
      return;
    }

    // Always fetch score directly from table highlight
    const scoreElem = document.querySelector('#results-container [data-score]');
    if (!scoreElem) {
       alert("Lütfen önce Puan Hesapla butonuna basarak puanınızı oluşturun.");
       return;
    }
    const mainScore = parseFloat(scoreElem.getAttribute('data-score'));

    const trial = {
      id: 'trial_' + Date.now(),
      examType: AppState.examType,
      year: AppState.activeYear,
      date: new Date().toISOString(),
      gy_net: parseFloat(gy_net.toFixed(2)),
      gk_net: parseFloat(gk_net.toFixed(2)),
      total_net: parseFloat(total_net.toFixed(2)),
      score: mainScore
    };

    AppState.trials = await DbManager.saveTrial(trial);
    
    document.querySelectorAll('#puan-form input[type="number"]').forEach(input => input.value = '');
    document.getElementById('results-container').innerHTML = ''; // clear table after save

    alert("Deneme başarısıyla sisteme kaydedildi!");
    this.calculateOverallStats();
    ChartManager.renderGeneralChart('general-progress-chart', AppState.trials);
  },

  // BRANCH TRIAL
  onBranchSelectChange() {
    const val = document.getElementById('branch-select').value;
    const customWrapper = document.getElementById('custom-branch-wrapper');
    if (val === 'CUSTOM_ADD') {
      customWrapper.classList.remove('hidden');
    } else {
      customWrapper.classList.add('hidden');
    }
    this.onBranchScoreChange();
  },

  onBranchScoreChange() {
    const correct = parseInt(document.getElementById('branch-correct').value) || 0;
    const incorrect = parseInt(document.getElementById('branch-incorrect').value) || 0;
    const net = correct - (incorrect / 4);
    document.getElementById('branch-net-display').textContent = net.toFixed(2);
  },

  async saveBranchTrial() {
    const select = document.getElementById('branch-select');
    let branchName = select.value;
    
    if (branchName === 'CUSTOM_ADD') {
      const customName = document.getElementById('custom-branch-name').value.trim();
      if (!customName) {
        alert("Lütfen yeni branş adını giriniz.");
        return;
      }
      branchName = customName;
      AppState.customBranches = await DbManager.saveCustomBranch(branchName);
      this.rebuildBranchSelectors();
      select.value = branchName;
      document.getElementById('custom-branch-wrapper').classList.add('hidden');
      document.getElementById('custom-branch-name').value = '';
    }

    const correct = parseInt(document.getElementById('branch-correct').value) || 0;
    const incorrect = parseInt(document.getElementById('branch-incorrect').value) || 0;
    const net = correct - (incorrect / 4);

    if (correct === 0 && incorrect === 0) {
      alert("Lütfen geçerli bir branş neti kaydetmek için doğru/yanlış değerleri girin.");
      return;
    }

    const bTrial = {
      id: 'btrial_' + Date.now(),
      branchName: branchName,
      date: new Date().toISOString(),
      correct: correct,
      incorrect: incorrect,
      net: parseFloat(net.toFixed(2))
    };

    AppState.branchTrials = await DbManager.saveBranchTrial(bTrial);

    document.getElementById('branch-correct').value = '';
    document.getElementById('branch-incorrect').value = '';
    this.onBranchScoreChange();

    alert(`${branchName} branş denemesi başarıyla kaydedildi!`);
    const activeGraphBranch = document.getElementById('graph-branch-select').value;
    ChartManager.renderBranchChart('branch-progress-chart', AppState.branchTrials, activeGraphBranch);
  },

  rebuildBranchSelectors() {
    const select = document.getElementById('branch-select');
    const graphSelect = document.getElementById('graph-branch-select');
    
    const activeVal = select.value;
    const activeGraphVal = graphSelect.value;
    
    const staticOptions = ['Türkçe', 'Matematik', 'Tarih', 'Coğrafya', 'Vatandaşlık'];
    
    select.innerHTML = '';
    graphSelect.innerHTML = '';

    staticOptions.forEach(opt => {
      select.add(new Option(`${opt} (${opt === 'Vatandaşlık' ? '9' : opt === 'Coğrafya' ? '18' : opt === 'Tarih' ? '27' : '30'} Soru)`, opt));
      graphSelect.add(new Option(opt, opt));
    });

    AppState.customBranches.forEach(cb => {
      select.add(new Option(cb, cb));
      graphSelect.add(new Option(cb, cb));
    });

    const optAdd = new Option('+ Yeni Branş Ekle...', 'CUSTOM_ADD');
    optAdd.className = "text-violetNeon font-bold";
    select.add(optAdd);

    select.value = activeVal;
    graphSelect.value = activeGraphVal;
  },

  onGraphBranchSelectChange() {
    const val = document.getElementById('graph-branch-select').value;
    ChartManager.renderBranchChart('branch-progress-chart', AppState.branchTrials, val);
  },

  // STATS
  calculateOverallStats() {
    const totalTrials = AppState.trials.length;
    document.getElementById('stat-total-trials').textContent = totalTrials;

    if (totalTrials > 0) {
      const sum = AppState.trials.reduce((acc, curr) => acc + curr.score, 0);
      const avg = sum / totalTrials;
      document.getElementById('stat-avg-score').textContent = avg.toFixed(2);
      const max = Math.max(...AppState.trials.map(t => t.score));
      document.getElementById('stat-max-score').textContent = max.toFixed(2);
    } else {
      document.getElementById('stat-avg-score').textContent = '0.00';
      document.getElementById('stat-max-score').textContent = '0.00';
    }

    document.getElementById('stat-total-sessions').textContent = AppState.focusSessionsCount;
  },

  // STOPWATCH
  openFocusOverlay() {
    document.getElementById('focus-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  closeFocusOverlay() {
    if (AppState.timerIsRunning) {
      if (!confirm("Kronometre çalışıyor. Odaktan çıkmak sayacı durduracaktır. Çıkmak istiyor musunuz?")) return;
      this.toggleStopwatch();
    }
    document.getElementById('focus-overlay').classList.remove('active');
    document.body.style.overflow = '';
  },

  toggleStopwatch() {
    const container = document.getElementById('timer-container');
    const status = document.getElementById('timer-status');
    const btnIcon = document.getElementById('timer-btn-icon');
    const btnText = document.getElementById('timer-btn-text');

    if (AppState.timerIsRunning) {
      clearInterval(AppState.timerInterval);
      AppState.timerIsRunning = false;
      container.classList.add('timer-paused');
      status.textContent = "DURAKLATILDI";
      status.className = "text-[10px] text-amber-500 tracking-widest uppercase mt-2";
      btnIcon.className = "fa-solid fa-play";
      btnText.textContent = "Devam Et";
    } else {
      AppState.timerIsRunning = true;
      container.classList.remove('timer-paused');
      status.textContent = "ODAKLANILIYOR";
      status.className = "text-[10px] text-emeraldNeon tracking-widest uppercase mt-2 animate-pulse";
      btnIcon.className = "fa-solid fa-pause";
      btnText.textContent = "Duraklat";

      if (AppState.timerSeconds === 0) {
        AppState.focusSessionsCount++;
        localStorage.setItem('kpss_focus_sessions', AppState.focusSessionsCount);
        this.calculateOverallStats();
      }

      AppState.timerInterval = setInterval(() => {
        AppState.timerSeconds++;
        this.updateStopwatchDisplay();
      }, 1000);
    }
  },

  updateStopwatchDisplay() {
    const hrs = Math.floor(AppState.timerSeconds / 3600);
    const mins = Math.floor((AppState.timerSeconds % 3600) / 60);
    const secs = AppState.timerSeconds % 60;
    const formatted = [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
    document.getElementById('focus-time-display').textContent = formatted;
  },

  resetStopwatch() {
    clearInterval(AppState.timerInterval);
    AppState.timerSeconds = 0;
    AppState.timerIsRunning = false;
    this.updateStopwatchDisplay();
    
    const container = document.getElementById('timer-container');
    container.classList.add('timer-paused');
    
    const status = document.getElementById('timer-status');
    status.textContent = "HAZIR";
    status.className = "text-[10px] text-emeraldNeon tracking-widest uppercase mt-2";
    
    document.getElementById('timer-btn-icon').className = "fa-solid fa-play";
    document.getElementById('timer-btn-text').textContent = "Başlat";
  },

  // FIREBASE CONFIG
  async saveFirebaseConfig() {
    const configStr = document.getElementById('firebase-config-json').value.trim();
    if (!configStr) {
      alert("Lütfen Firebase yapılandırma objesini yapıştırın.");
      return;
    }
    try {
      const parsed = JSON.parse(configStr);
      if (!parsed.apiKey || !parsed.projectId) {
        throw new Error("Geçersiz Firebase yapılandırma objesi.");
      }
      const success = await AuthManager.saveConfigAndConnect(parsed);
      if (success) {
        alert("Firebase bağlantısı başarıyla sağlandı!");
        this.closeSettingsModal();
        await this.loadAndRefreshAll();
      }
    } catch (err) {
      alert("Yapılandırma yüklenirken hata oluştu: " + err.message);
    }
  },

  disconnectFirebase() {
    if (confirm("Firebase bağlantısını kesmek istiyor musunuz? Verileriniz sadece local cihazınızda tutulacaktır.")) {
      AuthManager.disconnect();
      this.closeSettingsModal();
      alert("Firebase bağlantısı kesildi.");
      this.loadAndRefreshAll();
    }
  },

  closeSettingsModal() {
    document.getElementById('modal-settings').classList.add('hidden');
  },

  // AUTH
  closeAuthModal() {
    document.getElementById('modal-auth').classList.add('hidden');
    this.clearAuthAlert();
  },

  toggleAuthTab(tab) {
    AppState.authTab = tab;
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const btnSubmit = document.getElementById('btn-auth-submit');
    this.clearAuthAlert();

    if (tab === 'login') {
      tabLogin.className = "flex-1 text-center pb-3 text-sm font-bold text-slate-100 border-b-2 border-emeraldNeon uppercase tracking-wider";
      tabRegister.className = "flex-1 text-center pb-3 text-sm font-bold text-slate-400 hover:text-slate-200 border-b-2 border-transparent uppercase tracking-wider";
      btnSubmit.textContent = "Oturum Aç";
    } else {
      tabLogin.className = "flex-1 text-center pb-3 text-sm font-bold text-slate-400 hover:text-slate-200 border-b-2 border-transparent uppercase tracking-wider";
      tabRegister.className = "flex-1 text-center pb-3 text-sm font-bold text-slate-100 border-b-2 border-emeraldNeon uppercase tracking-wider";
      btnSubmit.textContent = "Hesap Oluştur & Giriş Yap";
    }
  },

  clearAuthAlert() {
    const box = document.getElementById('auth-alert');
    box.className = "hidden mb-4 p-3 rounded-lg text-xs border";
    box.innerHTML = "";
  },

  showAuthAlert(message, type = 'error') {
    const box = document.getElementById('auth-alert');
    box.classList.remove('hidden');
    if (type === 'error') {
      box.className = "mb-4 p-3 rounded-lg text-xs border border-rose-500/20 bg-rose-500/10 text-rose-400";
    } else {
      box.className = "mb-4 p-3 rounded-lg text-xs border border-emeraldNeon/20 bg-emeraldNeon/10 text-emeraldNeon";
    }
    box.textContent = message;
  },

  async handleAuthSubmit() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const isLogin = AppState.authTab === 'login';

    if (!email || !password) return;

    this.clearAuthAlert();
    document.getElementById('btn-auth-submit').disabled = true;

    try {
      if (isLogin) {
        await AuthManager.signIn(email, password);
        this.showAuthAlert("Başarıyla oturum açıldı! Yönlendiriliyorsunuz...", "success");
      } else {
        await AuthManager.signUp(email, password);
        this.showAuthAlert("Hesap başarıyla oluşturuldu! Yönlendiriliyorsunuz...", "success");
      }
      
      setTimeout(async () => {
        this.closeAuthModal();
        document.getElementById('btn-auth-submit').disabled = false;
        await DbManager.syncLocalToCloud();
        await this.loadAndRefreshAll();
      }, 1500);
      
    } catch (err) {
      document.getElementById('btn-auth-submit').disabled = false;
      let prettyMsg = "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.";
      if (err.code === 'auth/invalid-credential') prettyMsg = "Hatalı e-posta adresi veya şifre girdiniz.";
      else if (err.code === 'auth/weak-password') prettyMsg = "Şifreniz en az 6 karakter uzunluğunda olmalıdır.";
      else if (err.code === 'auth/email-already-in-use') prettyMsg = "Bu e-posta adresi zaten kullanımda.";
      else if (err.code === 'auth/invalid-email') prettyMsg = "Lütfen geçerli bir e-posta adresi girin.";
      this.showAuthAlert(prettyMsg, "error");
    }
  },

  async handleGoogleAuth() {
    this.clearAuthAlert();
    try {
      await AuthManager.signInWithGoogle();
      this.showAuthAlert("Başarıyla oturum açıldı! Yönlendiriliyorsunuz...", "success");
      setTimeout(async () => {
        this.closeAuthModal();
        await DbManager.syncLocalToCloud();
        await this.loadAndRefreshAll();
      }, 1500);
    } catch(err) {
      this.showAuthAlert("Google Giriş Hatası: " + err.message, "error");
    }
  },

  async logoutUser() {
    if (confirm("Oturumu kapatmak istediğinizden emin misiniz?")) {
      await AuthManager.logOut();
      alert("Oturum başarıyla kapatıldı.");
      await this.loadAndRefreshAll();
    }
  },

  async wipeDataConfirm() {
    if (confirm("DİKKAT! Tüm deneme verileriniz kalıcı olarak silinecektir. Emin misiniz?")) {
      await DbManager.wipeAllData();
      this.resetStopwatch();
      AppState.focusSessionsCount = 0;
      localStorage.removeItem('kpss_focus_sessions');
      alert("Tüm verileriniz başarıyla temizlendi.");
      await this.loadAndRefreshAll();
      this.switchTab('home');
    }
  }
};

document.getElementById('btn-logout').addEventListener('click', () => App.logoutUser());
document.addEventListener('DOMContentLoaded', () => App.init());
