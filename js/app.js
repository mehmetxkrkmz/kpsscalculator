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
  
  activeBranch: null,
  timerSeconds: 0,
  timerInterval: null,
  timerIsRunning: false,
  timerMode: 'up', // 'up' (stopwatch) or 'down' (countdown)
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
    const splash = document.getElementById('splash-screen');

    setTimeout(() => {
      if (splash) {
        splash.classList.add('fade-out');
      }
      this.createStars();
    }, 3200); // wait for letter animations to fully complete
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
      const displayName = user.displayName || email.split('@')[0];
      nameDisplay.textContent = displayName;
      avatar.textContent = displayName.charAt(0).toUpperCase();
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
    this.renderPastTrials();
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

    // btn-open-settings was removed, skip it

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
          this.showToast('Senkronizasyon basarili!', 'success');
          await this.loadAndRefreshAll();
        } else {
          this.showToast('Senkronizasyon hatasi olustu!', 'error');
        }
      });
    }

    document.getElementById('btn-focus-trigger').addEventListener('click', () => this.openFocusOverlay());
    document.getElementById('btn-timer-toggle').addEventListener('click', () => this.toggleStopwatch());
    document.getElementById('btn-timer-exit').addEventListener('click', () => this.closeFocusOverlay());

    // Note char counter
    const noteInput = document.getElementById('trial-note-input');
    const noteCount = document.getElementById('note-char-count');
    if (noteInput && noteCount) {
      noteInput.addEventListener('input', () => {
        noteCount.textContent = noteInput.value.length + '/300';
        noteCount.style.color = noteInput.value.length > 250 ? '#f59e0b' : '';
      });
    }
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
    this.setMobileTab(tabName);
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
       this.showToast('Katsayilar yuklenemedi. Sayfayi yenileyin.', 'error');
       return null;

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

    const examType = AppState.activeExamType;
    let expectedCols = [];
    if (examType === 'lisans') expectedCols = ['P1', 'P2', 'P3'];
    else if (examType === 'onlisans') expectedCols = ['P93'];
    else if (examType === 'ortaogretim') expectedCols = ['P94'];
    else expectedCols = resultsByYear[years[0]].map(r => r.name);
    
    let html = `
    <div class="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-2xl">
      <table class="w-full text-left text-xs text-slate-300">
        <thead class="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400">
          <tr>
            <th class="px-4 py-3 border-b border-slate-800 w-24">SINAV YILI</th>
            ${expectedCols.map(c => `<th class="px-4 py-3 border-b border-slate-800 text-right tracking-wider">${c}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/50 font-mono">
    `;

    years.forEach((year, idx) => {
        const isCurrent = idx === 0; // Most recent year
        const rowClass = isCurrent ? 'bg-emeraldNeon/10 glow-emerald/10' : 'hover:bg-slate-800/30 transition-colors';
        html += `<tr class="${rowClass}">
            <td class="px-4 py-3 font-bold ${isCurrent ? 'text-emeraldNeon' : 'text-slate-200'}">${year}</td>`;
        
        expectedCols.forEach(colName => {
            const res = resultsByYear[year].find(r => r.name === colName);
            if (res) {
               const color = res.isMain ? (isCurrent ? 'text-emeraldNeon font-bold text-sm' : 'text-slate-200 font-bold') : 'text-slate-400';
               const dataScoreAttr = res.isMain && isCurrent ? `data-score="${res.score}"` : '';
               html += `<td class="px-4 py-3 text-right ${color} tracking-tight" ${dataScoreAttr}>${res.score}</td>`;
            } else {
               html += `<td class="px-4 py-3 text-right text-slate-500">-</td>`;
            }
        });
        html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    </div>
    `;

    container.innerHTML = html;

    // Animated counter for score cells
    this.animateScoreCells();
    
    // Save state for saving the trial (defaults to the most recent year)
    AppState.activeYear = years[0]; 
  },

  // Animasyonlu puan sayacı
  animateScoreCells() {
    const cells = document.querySelectorAll('#results-container [data-score]');
    cells.forEach(cell => {
      const target = parseFloat(cell.getAttribute('data-score'));
      if (isNaN(target)) return;
      const start = performance.now();
      const duration = 900;
      const startVal = 0;
      const easeOut = t => 1 - Math.pow(1 - t, 3);
      const tick = (now) => {
        const elapsed = Math.min(now - start, duration);
        const progress = easeOut(elapsed / duration);
        const current = startVal + (target - startVal) * progress;
        cell.textContent = current.toFixed(5);
        if (elapsed < duration) {
          requestAnimationFrame(tick);
        } else {
          cell.textContent = target.toFixed(5);
          cell.classList.add('score-count-finish');
        }
      };
      requestAnimationFrame(tick);
    });
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
      this.showToast('Net degeri olusturacak dogru/yanlis giris yok.', 'warning');
      return;
    }

    // Always fetch score directly from table highlight
    const scoreElem = document.querySelector('#results-container [data-score]');
    if (!scoreElem) {
       this.showToast('Lutfen once Puan Hesapla butonuna basin.', 'warning');
       return;
    }
    const mainScore = parseFloat(scoreElem.getAttribute('data-score'));

    const note = (document.getElementById('trial-note-input')?.value || '').trim();

    const trial = {
      id: 'trial_' + Date.now(),
      examType: AppState.examType,
      year: AppState.activeYear,
      date: new Date().toISOString(),
      gy_net: parseFloat(gy_net.toFixed(2)),
      gk_net: parseFloat(gk_net.toFixed(2)),
      total_net: parseFloat(total_net.toFixed(2)),
      score: mainScore,
      note: note
    };

    AppState.trials = await DbManager.saveTrial(trial);
    
    document.querySelectorAll('#puan-form input[type="number"]').forEach(input => input.value = '');
    document.getElementById('results-container').innerHTML = ''; // clear table after save
    // Clear note
    const noteInput = document.getElementById('trial-note-input');
    if (noteInput) { noteInput.value = ''; }
    const noteCount = document.getElementById('note-char-count');
    if (noteCount) { noteCount.textContent = '0/300'; }

    this.showToast('Deneme basariyla kaydedildi!', 'success');
    this.calculateOverallStats();
    ChartManager.renderGeneralChart('general-progress-chart', AppState.trials);
    this.renderPastTrials();

    // Show achievement badge based on score
    this.showAchievement(mainScore);
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
        this.showToast('Lutfen brans adini giriniz.', 'warning');
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
      this.showToast('Dogru/yanlis degerlerini girin.', 'warning');
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

    this.showToast(branchName + ' brans denemesi kaydedildi!', 'success');
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

  // STOPWATCH & COUNTDOWN
  openFocusOverlay(mode = 'up') {
    AppState.timerMode = mode;
    document.getElementById('focus-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  startCountdownTimer() {
    const minStr = document.getElementById('countdown-input').value;
    const mins = parseInt(minStr, 10);
    if (!mins || mins <= 0) {
      this.showToast('Lutfen gecerli bir dakika giriniz.', 'warning');
      return;
    }
    
    this.resetStopwatch();
    AppState.timerSeconds = mins * 60;
    this.updateStopwatchDisplay();
    
    this.openFocusOverlay('down');
    this.toggleStopwatch();
  },

  closeFocusOverlay() {
    if (AppState.timerIsRunning) {
      this.toggleStopwatch(); // stop it
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

      if (AppState.timerSeconds === 0 && AppState.timerMode === 'up') {
        AppState.focusSessionsCount++;
        localStorage.setItem('kpss_focus_sessions', AppState.focusSessionsCount);
        this.calculateOverallStats();
      }

      AppState.timerInterval = setInterval(() => {
        if (AppState.timerMode === 'down') {
          AppState.timerSeconds--;
          if (AppState.timerSeconds <= 0) {
            this.toggleStopwatch();
            this.showToast('Sure doldu! Odaklanma oturumu tamamlandi.', 'success');
            AppState.focusSessionsCount++;
            localStorage.setItem('kpss_focus_sessions', AppState.focusSessionsCount);
            this.calculateOverallStats();
            AppState.timerSeconds = 0;
          }
        } else {
          AppState.timerSeconds++;
        }
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
    AppState.timerMode = 'up';
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
      this.showToast('Lutfen Firebase yapilandirma objesini yapistirin.', 'warning');
      return;
    }
    try {
      const parsed = JSON.parse(configStr);
      if (!parsed.apiKey || !parsed.projectId) {
        throw new Error('Gecersiz Firebase yapilandirma objesi.');
      }
      const success = await AuthManager.saveConfigAndConnect(parsed);
      if (success) {
        this.showToast('Firebase baglantisi basariyla saglandi!', 'success');
        this.closeSettingsModal();
        await this.loadAndRefreshAll();
      }
    } catch (err) {
      this.showToast('Yapilandirma hatasi: ' + err.message, 'error');
    }
  },

  disconnectFirebase() {
    AuthManager.disconnect();
    this.closeSettingsModal();
    this.showToast('Firebase baglantisi kesildi.', 'info');
    this.loadAndRefreshAll();
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
    await AuthManager.logOut();
    this.showToast('Oturum basariyla kapatildi.', 'info');
    await this.loadAndRefreshAll();
  },

  async wipeDataConfirm() {
    this.showConfirmModal(
      'DIKKAT! Tum deneme verileriniz kalici olarak silinecektir. Emin misiniz?',
      async () => {
        await DbManager.wipeAllData();
        this.resetStopwatch();
        AppState.focusSessionsCount = 0;
        localStorage.removeItem('kpss_focus_sessions');
        this.showToast('Tum verileriniz basariyla temizlendi.', 'info');
        await this.loadAndRefreshAll();
        this.switchTab('home');
      }
    );
  },

  // ==========================
  // TOAST NOTIFICATION SYSTEM
  // ==========================
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const colors = {
      success: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-300',
      error: 'border-rose-500/50 bg-rose-950/90 text-rose-300',
      warning: 'border-amber-500/50 bg-amber-950/90 text-amber-300',
      info: 'border-blue-500/50 bg-blue-950/90 text-blue-300'
    };
    const iconColors = { success: 'text-emerald-400', error: 'text-rose-400', warning: 'text-amber-400', info: 'text-blue-400' };
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl text-sm font-medium min-w-[280px] max-w-[380px] transition-all duration-300 ease-out opacity-0 -translate-y-4 ' + (colors[type] || colors.info);
    toast.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + ' text-base ' + (iconColors[type] || iconColors.info) + '"></i><span class="flex-1">' + message + '</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-50 hover:opacity-100 transition-opacity text-xs"><i class="fa-solid fa-xmark"></i></button>';
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.remove('opacity-0', '-translate-y-4'); });
    setTimeout(() => { toast.classList.add('opacity-0'); setTimeout(() => toast.remove(), 400); }, 3500);
  },

  // ==========================
  // CUSTOM CONFIRM MODAL
  // ==========================
  showConfirmModal(message, onConfirm) {
    const existing = document.getElementById('custom-confirm-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'custom-confirm-modal';
    modal.className = 'fixed inset-0 z-[12000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md';
    modal.innerHTML = '<div class="glass-panel w-full max-w-sm rounded-2xl p-6 border border-rose-500/20 shadow-2xl text-center"><div class="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4"><i class="fa-solid fa-triangle-exclamation text-rose-400 text-xl"></i></div><p class="text-slate-200 text-sm leading-relaxed mb-6">' + message + '</p><div class="flex gap-3"><button id="confirm-cancel" class="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-all duration-200">Vazgec</button><button id="confirm-ok" class="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold uppercase transition-all duration-200"><i class="fa-solid fa-trash-can mr-1"></i> Sil</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#confirm-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#confirm-ok').addEventListener('click', async () => { modal.remove(); await onConfirm(); });
  },

  // ==========================
  // PAST TRIALS LIST & DELETE
  // ==========================
  renderPastTrials() {
    const container = document.getElementById('past-trials-container');
    if (!container) return;
    const trials = AppState.trials;
    if (!trials || trials.length === 0) {
      container.innerHTML = '<p class="text-slate-500 text-xs text-center py-6">Henuz kaydedilmis bir genel deneme yok.</p>';
      return;
    }
    const sorted = [...trials].reverse();
    const examLabels = { lisans: 'Lisans', onlisans: 'On Lisans', ortaogretim: 'Ortaogretim', ogretmenlik: 'Ogretmenlik', dhbt: 'DHBT' };
    container.innerHTML = sorted.map((t, idx) => {
      const date = new Date(t.date);
      const dateStr = date.getDate().toString().padStart(2,'0') + '/' + (date.getMonth()+1).toString().padStart(2,'0') + '/' + date.getFullYear() + ' ' + date.getHours().toString().padStart(2,'0') + ':' + date.getMinutes().toString().padStart(2,'0');
      const originalIdx = trials.length - 1 - idx;
      const label = examLabels[t.examType] || t.examType;
      const noteHtml = t.note ? `<span class="trial-note-badge"><i class="fa-solid fa-pen-nib"></i>${t.note}</span>` : '';
      return `<div class="flex items-center justify-between gap-3 py-2.5 px-3 mb-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all">
        <div class="flex items-center gap-3 min-w-0 flex-wrap">
          <span class="text-[10px] font-mono text-slate-500 shrink-0">${dateStr}</span>
          <span class="text-[10px] font-bold text-violetNeon uppercase">${label}</span>
          <span class="text-xs text-emeraldNeon font-bold">${t.score ? t.score.toFixed(2) : '0.00'} puan</span>
          <span class="text-[10px] text-slate-400">Net: ${t.total_net ? t.total_net.toFixed(2) : '0.00'}</span>
          ${noteHtml}
        </div>
        <button onclick="App.deleteTrialByIndex(${originalIdx})" class="shrink-0 w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 text-rose-400 hover:text-white text-xs transition-all duration-200 flex items-center justify-center" title="Bu denemeyi sil">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>`;
    }).join('');
  },

  async deleteTrialByIndex(index) {
    this.showConfirmModal(
      'Bu deneme kaydi kalici olarak silinecek. Emin misiniz?',
      async () => {
        AppState.trials = await DbManager.deleteTrialByIndex(index);
        this.showToast('Deneme kaydi silindi.', 'info');
        this.calculateOverallStats();
        ChartManager.renderGeneralChart('general-progress-chart', AppState.trials);
        this.renderPastTrials();
      }
    );
  },

  // ==========================
  // ACHIEVEMENT BADGE + CONFETTI
  // ==========================
  showAchievement(score) {
    const overlay = document.getElementById('achievement-overlay');
    if (!overlay) return;

    let tier;
    if (score >= 85)      tier = { icon: '🏆', title: 'EFSANEVİ!', desc: 'Üstün Başarı Rozeti', color: '#f59e0b' };
    else if (score >= 75) tier = { icon: '🥇', title: 'MÜKEMMEL!', desc: 'Altın Performans', color: '#10b981' };
    else if (score >= 65) tier = { icon: '🥈', title: 'ÇOK İYİ!', desc: 'Gümüş Başarı', color: '#3b82f6' };
    else if (score >= 55) tier = { icon: '🎯', title: 'GÜZEL!', desc: 'Hedefte Kalmaya Devam', color: '#8b5cf6' };
    else                  tier = null; // No badge below 55

    if (!tier) return;

    // Confetti
    this.launchConfetti(tier.color);

    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="achievement-popup">
        <span class="achievement-icon">${tier.icon}</span>
        <div class="achievement-title" style="color:${tier.color}">${tier.title}</div>
        <span class="achievement-score">${score.toFixed(2)}</span>
        <div class="achievement-desc">${tier.desc}</div>
        <button
          onclick="this.closest('.achievement-popup').classList.add('hide'); setTimeout(()=>{document.getElementById('achievement-overlay').style.display='none';document.getElementById('achievement-overlay').classList.add('hidden')},500)"
          class="mt-5 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200"
          style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;"
        >Kapat</button>
      </div>
    `;
    // Auto close after 5s
    setTimeout(() => {
      const popup = overlay.querySelector('.achievement-popup');
      if (popup) {
        popup.classList.add('hide');
        setTimeout(() => {
          overlay.style.display = 'none';
          overlay.classList.add('hidden');
        }, 500);
      }
    }, 5000);
  },

  launchConfetti(accentColor = '#10b981') {
    const colors = [accentColor, '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ffffff'];
    const count = 80;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const startX = Math.random() * 100;
        const duration = 2.5 + Math.random() * 2;
        const size = 6 + Math.random() * 10;
        piece.style.cssText = `
          left: ${startX}vw;
          top: -20px;
          width: ${size}px;
          height: ${size * 1.4}px;
          background: ${color};
          border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
          animation-duration: ${duration}s;
          animation-delay: ${Math.random() * 0.8}s;
          transform: rotateZ(${Math.random() * 360}deg);
          opacity: 0.9;
        `;
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), (duration + 1) * 1000);
      }, i * 25);
    }
  },

  // ==========================
  // MOBILE TAB BAR SYNC
  // ==========================
  setMobileTab(tabName) {
    const items = document.querySelectorAll('.mobile-tab-item');
    items.forEach(item => item.classList.remove('active'));
    const target = tabName === 'home' ? 'mob-tab-home' : 'mob-tab-profile';
    const el = document.getElementById(target);
    if (el) el.classList.add('active');
  }
};

document.getElementById('btn-logout').addEventListener('click', () => App.logoutUser());
document.addEventListener('DOMContentLoaded', () => App.init());
