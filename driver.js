// driver.js - Partner Driver App for Jayasooriya Transport
// Handles: Mobile Login, Interactive Map with Geolocation & Distributors, Monthly KM Tracker, and Live/Finalized Salary Breakdown.

// Supabase Configuration (Matching admin app)
const SUPABASE_URL = 'https://slmqjqkpgdhrdcoempdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbXFqcWtwZ2RocmRjb2VtcGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3OTg4NzUsImV4cCI6MjA3NjM3NDg3NX0.mXDMuhn0K5sOKhwykhf9OcomUzSVkCGnN5jr60A-TSw';

let supabaseClient = null;
let currentDriver = null; // Stored driver partner record
let driverLorry = null;   // Assigned vehicle/lorry plate number
let driverLorryId = null; // Associated vehicle ID in table
let weeklyAdvanceChannel = null; // Supabase Realtime channel for weekly advance tracking
let activeMonth = "";     // YYYY-MM
let driverMap = null;
let markers = [];
let userLocationMarker = null;
let isOnline = true;
let distributorsList = [];
let locationWatchId = null; // Geolocation watcher ID

// ============ OPERATION LOGOS CONFIGURATION ============
const OPERATION_CONFIG = {
    kevilton: {
        name: 'Kevilton',
        logoUrl: 'https://i.postimg.cc/pTbqBcdz/idm2DKn-i-I.png',
        badgeClass: 'op-kevilton',
        color: '#D1001F'
    },
    pelwatte: {
        name: 'Pelwatte',
        logoUrl: 'https://i.postimg.cc/Kv7vZCdh/db809eadd12d21eb61044e0f3bf7c9b7.jpg',
        badgeClass: 'op-pelwatte',
        color: '#00B37E'
    },
    spacelogistics: {
        name: 'Space Logistics',
        logoUrl: 'https://i.postimg.cc/65VKKKR2/images-(1).jpg',
        badgeClass: 'op-space-logistics',
        color: '#001a3f'
    }
};

// ============ LANGUAGE / TRANSLATIONS ============
const TRANSLATIONS = {
    en: {
        'offline.banner': '⚠️ You are offline. Displaying cached information.',
        'login.phone': 'Phone Number',
        'login.phonePlaceholder': 'e.g. 0771234567',
        'login.password': 'Password',
        'login.passwordPlaceholder': 'Enter your password',
        'login.helper': "Contact your administrator if you don't have a password yet.",
        'login.signIn': 'Sign In',
        'login.signingIn': 'Signing in...',
        'login.footer': '© 2026 Jayasooriya Transport Services',
        'dashboard.partner': 'Partner',
        'dashboard.distanceThisMonth': 'DISTANCE THIS MONTH',
        'dashboard.basicSalary': 'BASIC SALARY',
        'dashboard.tapForDetails': 'TAP FOR DETAILS ↗',
        'dashboard.km': 'KM',
        'dashboard.assignedVehicle': 'ASSIGNED VEHICLE',
        'dashboard.online': 'ONLINE',
        'dashboard.offline': 'OFFLINE',
        'drawer.title': 'Distribution Points List',
        'drawer.searchPlaceholder': '🔍 Search town or distributor...',
        'drawer.loading': 'Loading locations...',
        'drawer.noResults': 'No distribution points found.',
        'salary.title': 'Salary & Earnings',
        'salary.month': 'Month:',
        'salary.finalizedTitle': 'SALARY FINALIZED',
        'salary.finalizedDesc': "Your administrator has finalized this month's salary.",
        'salary.liveTitle': 'LIVE ESTIMATE',
        'salary.liveDesc': 'Calculated from active records. Subject to changes.',
        'salary.totalKm': 'TOTAL KM THIS MONTH',
        'salary.advances': '📉 Salary Advances',
        'salary.totalAdvances': 'Total Advances Drawn',
        'salary.dayOffs': '🗓️ Day Off Deductions',
        'salary.totalDayOffs': 'Total Day-Off Deductions',
        'salary.otherDeductions': '⚠️ Other Deductions',
        'salary.totalDeductions': 'Total Other Deductions',
        'salary.profile': '👤 My Profile Details',
        'salary.role': 'Role',
        'salary.contact': 'Contact',
        'salary.license': 'License Number',
        'salary.age': 'Age',
        'salary.address': 'Address',
        'salary.logout': 'Logout App',
        'salary.noAdvances': 'No advances taken this month',
        'salary.noDayOffs': 'No day offs taken this month',
        'salary.noDeductions': 'No other deductions this month',
        'advance.weeklyLimit': '📅 WEEKLY ADVANCE LIMIT',
        'advance.remaining': 'REMAINING THIS WEEK',
        'advance.resetsMonday': 'Resets Monday',
        'advance.resetsIn': 'Resets in',
        'advance.days': 'days',
        'advance.day': 'day',
        'advance.today': 'Resets today (Monday) ✨',
        'advance.usedOf': 'used of',
        'advance.left': 'left',
        'advance.limitReached': '⚠️ Weekly limit reached',
        'race.title': '🏁 Driver Race',
        'race.standings': 'Standings',
        'race.loading': 'Loading standings...',
        'race.noDrivers': "No drivers in this month's race.",
        'race.you': 'You',
        'race.failed': 'Failed to load race: ',
        'greeting.morning': 'Good morning',
        'greeting.afternoon': 'Good afternoon',
        'greeting.evening': 'Good evening',
        'greeting.default': 'Hello',
        'confirm.logout': 'Are you sure you want to log out?',
        'confirm.yes': 'Yes',
        'confirm.no': 'No',
        'error.noDriver': 'No driver found with this phone number. Check the format or make sure your profile is active in the admin portal.',
        'error.wrongPassword': 'Incorrect password. Please check your credentials or contact your administrator.',
        'error.yearRange': 'Please select a month within the current year range.',
        'map.youAreHere': 'You are here',
        'map.openInMaps': '🗺️ Open in Google Maps',
        'map.navigate': '🗺️ Navigate',
        'map.copyLink': '📋 Copy Link',
        'map.copied': 'Copied!',
        'race.helpers': 'Helpers',
        'race.driver': 'Driver',
        'race.helper': 'Helper',
        'race.new': 'NEW',
    },
    si: {
        'offline.banner': '⚠️ ඔබ අසබැඳිව සිටී. සුරැකි තොරතුරු පෙන්වමින් ඇත.',
        'login.phone': 'දුරකථන අංකය',
        'login.phonePlaceholder': 'උදා: 0771234567',
        'login.password': 'මුරපදය',
        'login.passwordPlaceholder': 'ඔබේ මුරපදය ඇතුළු කරන්න',
        'login.helper': 'ඔබට තවම මුරපදයක් නොමැති නම් ඔබේ පරිපාලකයා අමතන්න.',
        'login.signIn': 'ඇතුල් වන්න',
        'login.signingIn': 'ඇතුල් වෙමින්...',
        'login.footer': '© 2026 ජයසූරිය ප්‍රවාහන සේවා',
        'dashboard.partner': 'හවුල්කරු',
        'dashboard.distanceThisMonth': 'මෙම මාසයේ දුර',
        'dashboard.basicSalary': 'මූලික වැටුප',
        'dashboard.tapForDetails': 'විස්තර සඳහා තට්ටු කරන්න ↗',
        'dashboard.km': 'කි.මී.',
        'dashboard.assignedVehicle': 'පවරන ලද වාහනය',
        'dashboard.online': 'සබැඳි',
        'dashboard.offline': 'අසබැඳි',
        'drawer.title': 'බෙදාහැරීම් ස්ථාන ලැයිස්තුව',
        'drawer.searchPlaceholder': '🔍 නගරය හෝ බෙදාහරින්නා සොයන්න...',
        'drawer.loading': 'ස්ථාන පූරණය වෙමින්...',
        'drawer.noResults': 'බෙදාහැරීම් ස්ථාන හමු නොවීය.',
        'salary.title': 'වැටුප් සහ ඉපැයීම්',
        'salary.month': 'මාසය:',
        'salary.finalizedTitle': 'වැටුප් අවසන් කරා',
        'salary.finalizedDesc': 'ඔබේ පරිපාලකයා මෙම මාසයේ වැටුප් අවසන් කර ඇත.',
        'salary.liveTitle': 'සජීවී ඇස්තමේන්තුව',
        'salary.liveDesc': 'සක්‍රිය වාර්තාවලින් ගණනය කෙරේ. වෙනස් විය හැක.',
        'salary.totalKm': 'මෙම මාසයේ සම්පූර්ණ කි.මී.',
        'salary.advances': '📉 වැටුප් අත්තිකාරම්',
        'salary.totalAdvances': 'ගත් මුළු අත්තිකාරම්',
        'salary.dayOffs': '🗓️ දිනය ලබාගැනීමේ කැපීම්',
        'salary.totalDayOffs': 'දිනය ලබාගැනීමේ මුළු කැපීම්',
        'salary.otherDeductions': '⚠️ වෙනත් කැපීම්',
        'salary.totalDeductions': 'මුළු වෙනත් කැපීම්',
        'salary.profile': '👤 මගේ පැතිකඩ විස්තර',
        'salary.role': 'භූමිකාව',
        'salary.contact': 'ඇමතුම',
        'salary.license': 'බලපත්‍ර අංකය',
        'salary.age': 'වයස',
        'salary.address': 'ලිපිනය',
        'salary.logout': 'යෙදුමෙන් ඉවත් වන්න',
        'salary.noAdvances': 'මෙම මාසයේ අත්තිකාරම් නොමැත',
        'salary.noDayOffs': 'මෙම මාසයේ දිනය ලබාගැනීම් නොමැත',
        'salary.noDeductions': 'මෙම මාසයේ වෙනත් කැපීම් නොමැත',
        'advance.weeklyLimit': '📅 සතිය අත්තිකාරම් සීමාව',
        'advance.remaining': 'මෙම සතියේ ඉතිරිය',
        'advance.resetsMonday': 'සඳුදා යළිත් ආරම්භ',
        'advance.resetsIn': 'යළිත් ආරම්භ',
        'advance.days': 'දිනවල',
        'advance.day': 'දිනෙකින්',
        'advance.today': 'අද (සඳුදා) යළිත් ✨',
        'advance.usedOf': 'භාවිතා කෙරිනි',
        'advance.left': 'ඉතිරිව ඇත',
        'advance.limitReached': '⚠️ සතිය සීමාව ළඟා',
        'race.title': '🏁 රියදුරු ධාවනය',
        'race.standings': 'ශ්‍රේණිගත කිරීම',
        'race.loading': 'ශ්‍රේණිගත කිරීම් පූරණය වෙමින්...',
        'race.noDrivers': 'මෙම මාසයේ රියදුරු ධාවනයේ කිසිවෙකු නොමැත.',
        'race.you': 'ඔබ',
        'race.failed': 'ධාවනය පූරණය නොවීය: ',
        'greeting.morning': 'සුබ උදෑසනක්',
        'greeting.afternoon': 'සුබ දහවලක්',
        'greeting.evening': 'සුබ සන්ධ්‍යාවක්',
        'greeting.default': 'ආයුබෝවන්',
        'confirm.logout': 'ඔබට ඇත්තෙන්ම ඉවත් වීමට අවශ්‍යද?',
        'confirm.yes': 'ඔව්',
        'confirm.no': 'නැහැ',
        'error.noDriver': 'මෙම දුරකථන අංකයෙන් රියදුරෙකු හමු නොවීය. ආකෘතිය පරීක්ෂා කරන්න.',
        'error.wrongPassword': 'වැරදි මුරපදය. ඔබේ අක්තපත්‍ර පරීක්ෂා කරන්න.',
        'error.yearRange': 'කරුණාකර වත්මන් වර්ෂ පරාසය තුළ මාසයක් තෝරන්න.',
        'map.youAreHere': 'ඔබ මෙහි සිටී',
        'map.openInMaps': '🗺️ Google Maps හි විවෘත කරන්න',
        'map.navigate': '🗺️ සංචාලනය',
        'map.copyLink': '📋 සබැඳිය පිටපත් කරන්න',
        'map.copied': 'පිටපත් කරා!',
        'race.helpers': 'රිය සහයවරුන්',
        'race.driver': 'රියදුරු',
        'race.helper': 'රිය සහය',
        'race.new': 'නව',
    }
};

// Translate helper — returns string for current language (falls back to English)
function t(key) {
    const lang = getCurrentLang();
    return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key])
        || (TRANSLATIONS['en'] && TRANSLATIONS['en'][key])
        || key;
}

// Safe localStorage wrapper for browsers with Tracking Prevention or storage restrictions
const inMemoryStorage = {};

function safeStorageGet(key) {
    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(key);
        }
    } catch (e) {
        console.warn('localStorage getItem blocked by browser tracking prevention:', e.message);
    }
    return inMemoryStorage[key] || null;
}

function safeStorageSet(key, value) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
        }
    } catch (e) {
        console.warn('localStorage setItem blocked by browser tracking prevention:', e.message);
    }
    inMemoryStorage[key] = value;
}

function safeStorageRemove(key) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
        }
    } catch (e) {
        console.warn('localStorage removeItem blocked by browser tracking prevention:', e.message);
    }
    delete inMemoryStorage[key];
}

// Get saved language code (defaults to 'en')
function getCurrentLang() {
    return safeStorageGet('jt_driver_lang') || 'en';
}

function calculateAge(dobStr) {
    if (!dobStr) return null;
    const birthDate = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function formatDriverAge(ageVal) {
    if (!ageVal) return '-';
    if (ageVal > 19000000) {
        const y = Math.floor(ageVal / 10000);
        const m = Math.floor((ageVal % 10000) / 100);
        const d = ageVal % 100;
        const dobStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const age = calculateAge(dobStr);
        return age !== null ? `${age} years` : '-';
    }
    return `${ageVal} years`;
}

// Apply language to all data-i18n elements in the DOM and update toggle buttons
function setLanguage(lang) {
    safeStorageSet('jt_driver_lang', lang);
    document.documentElement.lang = lang === 'si' ? 'si' : 'en';

    // Update textContent for all labelled elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]);
        if (val !== undefined) el.textContent = val;
    });

    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const val = (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]);
        if (val !== undefined) el.placeholder = val;
    });

    // Update the toggle button labels on both login and dashboard
    const label = lang === 'si' ? '🌐 SI' : '🌐 EN';
    const dashBtn = document.getElementById('langToggleBtn');
    const loginBtn = document.getElementById('loginLangToggleBtn');
    if (dashBtn) dashBtn.textContent = label;
    if (loginBtn) loginBtn.textContent = label;

    // Refresh status text to match new language
    const statusTextEl = document.getElementById('statusText');
    if (statusTextEl) {
        statusTextEl.textContent = isOnline ? t('dashboard.online') : t('dashboard.offline');
    }
}

// Toggle between English and Sinhala
function toggleLanguage() {
    const newLang = getCurrentLang() === 'en' ? 'si' : 'en';
    setLanguage(newLang);
}

// ============ THEME / LIGHT-DARK MODE ============
function getCurrentTheme() {
    return safeStorageGet('jt_driver_theme') || 'dark';
}

function applyTheme(theme) {
    safeStorageSet('jt_driver_theme', theme);
    const isDark = theme === 'dark';
    document.body.classList.toggle('light-mode', !isDark);
    document.body.classList.toggle('dark-mode', isDark);

    // Update theme-color meta tag for Android status bar
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#080A0F' : '#F5F6FA');
    }

    // Update all theme toggle button icons
    const icon = isDark ? '\u{1F319}' : '\u2600\uFE0F';
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.textContent = icon;
    });
}

function toggleTheme() {
    const newTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Utility helpers for staff nicknames
function cleanDriverName(fullName) {
    return (fullName || '').replace(/\s*\(.*?\)\s*$/, '').trim();
}

// Local Storage Caching Helpers for Offline Support
function getCachedData(key, defaultValue = null) {
    try {
        const val = safeStorageGet(key);
        return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
        console.warn('Cache read error for key:', key, e);
        return defaultValue;
    }
}

// Write to cache helper
function setCachedData(key, value) {
    try {
        if (value === null || value === undefined) {
            safeStorageRemove(key);
        } else {
            safeStorageSet(key, JSON.stringify(value));
        }
    } catch (e) {
        console.warn('Cache write error for key:', key, e);
    }
}

// Default corporate colored truck/lorry vector SVG art (Ultra Modern Isuzu/Fuso Commercial Transport)
const defaultLorrySVG = `
<svg viewBox="0 0 120 60" class="vehicle-svg-art" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cabGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#CBD5E1"/>
    </linearGradient>
    <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <linearGradient id="chassisGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="windshieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
  </defs>

  <!-- Shadow -->
  <ellipse cx="60" cy="53" rx="52" ry="4" fill="rgba(0,0,0,0.35)"/>

  <!-- Main Container Box (Refrigerated / Delivery Body) -->
  <rect x="8" y="10" width="62" height="34" rx="3" fill="url(#boxGrad)" stroke="#94A3B8" stroke-width="1.2"/>
  <line x1="8" y1="27" x2="70" y2="27" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="4,2"/>
  <!-- Cooling Unit on Top Front -->
  <rect x="66" y="8" width="8" height="6" rx="1.5" fill="#64748B"/>

  <!-- Truck Cab (Mitsubishi Fuso / Isuzu Style) -->
  <path d="M 70,18 L 86,18 Q 98,18 103,26 L 108,36 Q 110,40 106,44 L 70,44 Z" fill="url(#cabGrad)" stroke="#94A3B8" stroke-width="1.2"/>

  <!-- Windshield Glass -->
  <path d="M 85,20 L 96,20 Q 100,20 103,26 L 104,32 L 85,32 Z" fill="url(#windshieldGrad)" opacity="0.9"/>
  <!-- Side Door Window Frame -->
  <rect x="74" y="22" width="9" height="10" rx="1" fill="url(#windshieldGrad)" opacity="0.8"/>

  <!-- Front Bumper & Headlights -->
  <rect x="104" y="38" width="6" height="5" rx="1" fill="#E2E8F0" stroke="#64748B" stroke-width="0.8"/>
  <rect x="107" y="39" width="3" height="3" rx="0.5" fill="#FEF08A"/>

  <!-- Chassis Lower Bar -->
  <rect x="12" y="43" width="92" height="3" fill="url(#chassisGrad)"/>

  <!-- Wheels (Front & Rear Dual Wheels) -->
  <circle cx="24" cy="46" r="7.5" fill="#0F172A" stroke="#475569" stroke-width="1.5"/>
  <circle cx="24" cy="46" r="3.5" fill="#94A3B8"/>
  <circle cx="24" cy="46" r="1.5" fill="#0F172A"/>

  <circle cx="42" cy="46" r="7.5" fill="#0F172A" stroke="#475569" stroke-width="1.5"/>
  <circle cx="42" cy="46" r="3.5" fill="#94A3B8"/>
  <circle cx="42" cy="46" r="1.5" fill="#0F172A"/>

  <circle cx="92" cy="46" r="7.5" fill="#0F172A" stroke="#475569" stroke-width="1.5"/>
  <circle cx="92" cy="46" r="3.5" fill="#94A3B8"/>
  <circle cx="92" cy="46" r="1.5" fill="#0F172A"/>
</svg>
`;

// ============ DRIVER TOAST NOTIFICATION SYSTEM ============
function showDriverToast(message, type = 'info', duration = 3500) {
    // Inject styles if not already present
    if (!document.getElementById('driverToastStyles')) {
        const style = document.createElement('style');
        style.id = 'driverToastStyles';
        style.textContent = `
            .driver-toast-container { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 99999; display: flex; flex-direction: column; gap: 8px; align-items: center; pointer-events: none; }
            .driver-toast { padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.25); animation: driverToastIn 0.3s ease; max-width: 320px; text-align: center; pointer-events: auto; }
            .driver-toast.success { background: linear-gradient(135deg, #00B37E, #007A54); }
            .driver-toast.error   { background: linear-gradient(135deg, #D1001F, #8B0000); }
            .driver-toast.warning { background: linear-gradient(135deg, #E07B00, #B35E00); }
            .driver-toast.info    { background: linear-gradient(135deg, #0072CE, #004A8F); }
            .driver-toast.fade-out { animation: driverToastOut 0.3s ease forwards; }
            @keyframes driverToastIn  { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes driverToastOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(16px); } }
            .driver-confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 99998; display: flex; align-items: center; justify-content: center; animation: driverToastIn 0.2s ease; }
            .driver-confirm-box { background: #fff; border-radius: 16px; padding: 24px 28px; max-width: 320px; width: 90%; box-shadow: 0 16px 48px rgba(0,0,0,0.3); text-align: center; }
            .driver-confirm-box .dc-msg { font-size: 15px; font-weight: 600; color: #1A1D24; margin-bottom: 20px; line-height: 1.5; }
            .driver-confirm-box .dc-btns { display: flex; gap: 10px; justify-content: center; }
            .driver-confirm-box .dc-yes { background: #D1001F; color: #fff; border: none; border-radius: 10px; padding: 10px 24px; font-size: 14px; font-weight: 700; cursor: pointer; }
            .driver-confirm-box .dc-no  { background: #E2E5EA; color: #1A1D24; border: none; border-radius: 10px; padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer; }
        `;
        document.head.appendChild(style);
    }
    let container = document.getElementById('driverToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'driverToastContainer';
        container.className = 'driver-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `driver-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showDriverConfirm(message, onYes, onNo = null) {
    const overlay = document.createElement('div');
    overlay.className = 'driver-confirm-overlay';
    overlay.innerHTML = `
        <div class="driver-confirm-box">
            <div class="dc-msg">${message}</div>
            <div class="dc-btns">
                <button class="dc-yes">${t('confirm.yes')}</button>
                <button class="dc-no">${t('confirm.no')}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.dc-yes').addEventListener('click', () => { overlay.remove(); if (onYes) onYes(); });
    overlay.querySelector('.dc-no').addEventListener('click',  () => { overlay.remove(); if (onNo) onNo(); });
}

// Online/Offline status banner toggle
function updateOnlineStatus() {
    const banner = document.getElementById('offlineWarningBanner');
    if (banner) {
        if (navigator.onLine) {
            banner.classList.add('hidden');
        } else {
            banner.classList.remove('hidden');
        }
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Starting point
const KD_START_POINT = {
    name: 'John Keells Enderamulla',
    town: 'Enderamulla, Wattala',
    lat: 6.993777247636533,
    lng: 79.91975853540127,
    logoUrl: 'https://i.postimg.cc/QdvbXY1c/id-AYs-TFstv.png'
};

// Initialize App
function initApp() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error('Supabase library not loaded');
        showDriverToast('Could not initialize database connection. Please reload.', 'error', 5000);
        return;
    }

    // Register Service Worker for PWA installability
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js?v=3')
            .then(reg => console.log('Driver App PWA Service Worker Registered', reg.scope))
            .catch(err => console.error('Driver App PWA Service Worker Registration Failed', err));
    }

    updateOnlineStatus(); // Set initial online banner visibility state
    setDefaultMonth();
    setupEventHandlers();
    setLanguage(getCurrentLang()); // Apply saved language on startup
    applyTheme(getCurrentTheme()); // Apply saved theme on startup
    checkExistingSession();
}

// Set default month using the current year dynamically
function setDefaultMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    activeMonth = `${year}-${month}`;
    
    const el = document.getElementById('salaryMonthFilter');
    if (el) {
        el.value = activeMonth;
        // Allow current year and one year back/forward
        el.min = `${year - 1}-01`;
        el.max = `${year + 1}-12`;
    }
}

// Check if driver is already logged in
async function checkExistingSession() {
    const savedDriver = safeStorageGet('jt_driver_session');
    if (savedDriver) {
        try {
            currentDriver = JSON.parse(savedDriver);
            
            if (!navigator.onLine) {
                // If offline, bypass database check and load dashboard directly
                showDashboard();
                return;
            }

            // Refresh driver data from DB to ensure it's up to date
            const { data, error } = await supabaseClient
                .from('drivers')
                .select('*')
                .eq('id', currentDriver.id)
                .single();
                
            if (!error && data && !data.terminated) {
                currentDriver = data;
                safeStorageSet('jt_driver_session', JSON.stringify(currentDriver));
                showDashboard();
            } else {
                if (error && error.status !== 401 && error.status !== 403) {
                    // Fallback to cached session on general database connection error
                    showDashboard();
                } else {
                    logout();
                }
            }
        } catch (e) {
            console.error('Session restore failed:', e);
            logout();
        }
    } else {
        showView('loginView');
    }
}

// Switch between views
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.add('active');
    }
}

// Setup Event Handlers
function setupEventHandlers() {
    // Login Form Submit
    const loginForm = document.getElementById('driverLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const contact = document.getElementById('loginContact').value;
            const license = document.getElementById('loginLicense').value;
            const errorEl = document.getElementById('loginError');
            const submitBtn = document.getElementById('loginSubmitBtn');
            
            errorEl.style.display = 'none';
            errorEl.textContent = '';
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = t('login.signingIn');

            try {
                const driver = await authenticateDriver(contact, license);
                currentDriver = driver;
                safeStorageSet('jt_driver_session', JSON.stringify(currentDriver));
                showDashboard();
            } catch (err) {
                errorEl.textContent = err.message || 'Authentication failed';
                errorEl.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = t('login.signIn');
            }
        });
    }

    // Recenter Map Button
    const recenterBtn = document.getElementById('recenterMapBtn');
    if (recenterBtn) {
        recenterBtn.addEventListener('click', () => {
            trackUserLocation(true);
        });
    }

    // Language Toggle Buttons (login page + dashboard)
    document.getElementById('langToggleBtn')?.addEventListener('click', toggleLanguage);
    document.getElementById('loginLangToggleBtn')?.addEventListener('click', toggleLanguage);

    // Theme Toggle Buttons (login page + dashboard)
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
    document.getElementById('loginThemeToggleBtn')?.addEventListener('click', toggleTheme);

    // Toggle Offline / Online status
    const statusBtn = document.getElementById('statusToggleBtn');
    if (statusBtn) {
        statusBtn.addEventListener('click', () => {
            isOnline = !isOnline;
            if (isOnline) {
                statusBtn.className = 'status-btn online';
                document.getElementById('statusText').textContent = t('dashboard.online');
            } else {
                statusBtn.className = 'status-btn offline';
                document.getElementById('statusText').textContent = t('dashboard.offline');
                statusBtn.style.color = '#FF2040';
                statusBtn.style.borderColor = 'rgba(255, 32, 64, 0.4)';
            }
        });
    }

    // Touchable KM Card triggers Salary Modal
    const kmCard = document.getElementById('kmSummaryCard');
    if (kmCard) {
        kmCard.addEventListener('click', () => {
            openSalaryModal();
        });
        kmCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                openSalaryModal();
            }
        });
    }

    // Close Salary Modal Buttons
    document.getElementById('closeSalaryModalBtn')?.addEventListener('click', closeSalaryModal);
    document.getElementById('closeSalaryModalBackdrop')?.addEventListener('click', closeSalaryModal);

    // Logout Button in Modal
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        showDriverConfirm(t('confirm.logout'), () => logout());
    });

    // Month Selector in Salary Modal — allows current year ± 1
    document.getElementById('salaryMonthFilter')?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
            const selectedYear = parseInt(val.split('-')[0]);
            const currentYear = new Date().getFullYear();
            if (Math.abs(selectedYear - currentYear) > 1) {
                showDriverToast(t('error.yearRange'), 'warning');
                const now = new Date();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                activeMonth = `${currentYear}-${month}`;
                e.target.value = activeMonth;
            } else {
                activeMonth = val;
            }
        }
        loadSalaryDetails();
    });

    // Race Modal Events
    document.getElementById('raceModalBtn')?.addEventListener('click', openRaceModal);
    document.getElementById('closeRaceModalBtn')?.addEventListener('click', closeRaceModal);
    document.getElementById('closeRaceModalBackdrop')?.addEventListener('click', closeRaceModal);

    // Drawer handle tap toggle
    const handleBar = document.getElementById('distributorDrawerHandle');
    const drawer = document.getElementById('distributorDrawer');
    const arrow = handleBar?.querySelector('.drawer-toggle-arrow');
    
    if (handleBar && drawer) {
        handleBar.addEventListener('click', () => {
            drawer.classList.toggle('open');
            arrow?.classList.toggle('open');
            if (drawer.classList.contains('open')) {
                arrow.textContent = '▼';
            } else {
                arrow.textContent = '▲';
            }
        });
    }

    // Search distributors
    const searchInput = document.getElementById('searchDistributors');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterDistributorsList(e.target.value);
        });
    }
}

// Authentication Logic
async function authenticateDriver(contact, password) {
    const cleanContact = contact.trim();
    const cleanPassword = password ? password.trim() : "";

    let { data, error } = await supabaseClient
        .from('drivers')
        .select('*')
        .eq('contact', cleanContact)
        .neq('terminated', true);

    // Suffix match fallback for Sri Lankan phone number format variation
    if ((!data || data.length === 0) && !error) {
        const digitsOnly = cleanContact.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 9) {
            const last9 = digitsOnly.slice(-9);
            const fallbackQuery = await supabaseClient
                .from('drivers')
                .select('*')
                .ilike('contact', `%${last9}`)
                .neq('terminated', true);
            
            if (!fallbackQuery.error && fallbackQuery.data && fallbackQuery.data.length > 0) {
                data = fallbackQuery.data;
            }
        }
    }

    if (error) {
        throw new Error('Database error: ' + error.message);
    }

    if (!data || data.length === 0) {
        throw new Error(t('error.noDriver'));
    }

    // Check credentials:
    // Priority 1: Match against the dedicated `password` field (if set)
    // Priority 2: Fall back to license_number match (backward compatibility)
    const matched = data.find(d => {
        if (d.password && d.password.trim() !== '') {
            // Password field is set — must match exactly (case-insensitive)
            return d.password.trim().toLowerCase() === cleanPassword.toLowerCase();
        } else {
            // No password set — fall back to license_number
            const dbLic = d.license_number ? d.license_number.trim().toLowerCase() : "";
            return dbLic === cleanPassword.toLowerCase();
        }
    });

    if (!matched) {
        throw new Error(t('error.wrongPassword'));
    }

    return matched;
}

// Show logout confirmation dialog / Instant logout handler
function confirmLogout() {
    logout();
}
window.confirmLogout = confirmLogout;

// Unsubscribe realtime advance channel
function unsubscribeWeeklyAdvance() {
    if (weeklyAdvanceChannel && supabaseClient) {
        try {
            supabaseClient.removeChannel(weeklyAdvanceChannel);
        } catch (e) {
            console.warn('Realtime channel unsubscribe error:', e);
        }
        weeklyAdvanceChannel = null;
    }
}
window.unsubscribeWeeklyAdvance = unsubscribeWeeklyAdvance;

// Logout driver partner
function logout() {
    try {
        if (locationWatchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
        }
        userLocationMarker = null;
        unsubscribeWeeklyAdvance();
    } catch (err) {
        console.warn('Logout location cleanup warning:', err);
    }

    try {
        safeStorageRemove('jt_driver_session');
        safeStorageRemove('jt_driver_race_standings');
    } catch (err) {
        console.warn('Logout storage cleanup warning:', err);
    }

    currentDriver = null;
    driverLorry = null;
    driverLorryId = null;

    try {
        if (driverMap) {
            driverMap.remove();
            driverMap = null;
        }
    } catch (err) {}

    // Reset login inputs
    try {
        const contactEl = document.getElementById('loginContact');
        const licenseEl = document.getElementById('loginLicense');
        if (contactEl) contactEl.value = '';
        if (licenseEl) licenseEl.value = '';
    } catch (err) {}

    try {
        closeSalaryModal();
    } catch (err) {}

    try {
        showView('loginView');
    } catch (err) {}

    try {
        showDriverToast(t('logout.success') || 'Logged out successfully', 'info', 2500);
    } catch (err) {}
}
window.logout = logout;

// Load and show dashboard
async function showDashboard() {
    showView('dashboardView');
    
    // Update basic UI fields with dynamic greeting and cleaned name (no nickname)
    const hr = new Date().getHours();
    let greeting = t('greeting.default');
    if (hr < 12) greeting = t('greeting.morning');
    else if (hr < 17) greeting = t('greeting.afternoon');
    else greeting = t('greeting.evening');
    
    const welcomeEl = document.querySelector('.welcome-text');
    if (welcomeEl) {
        welcomeEl.textContent = `${greeting},`;
    }

    document.getElementById('driverName').textContent = cleanDriverName(currentDriver.name);
    if (currentDriver.photo_url) {
        document.getElementById('driverAvatar').src = currentDriver.photo_url;
    }

    // Render Operation Badge & Coordinator Badge on Header
    const opWrap = document.getElementById('driverOperationBadgeWrap');
    if (opWrap) {
        if (currentDriver.operation) {
            const opKey = currentDriver.operation.toLowerCase();
            const opConf = OPERATION_CONFIG[opKey];
            if (opConf) {
                let coordBadge = '';
                if (currentDriver.is_coordinator) {
                    coordBadge = `<span class="driver-coordinator-badge" title="Operation Coordinator">⭐ Coordinator</span>`;
                }
                opWrap.innerHTML = `
                    <div class="driver-op-badge ${opConf.badgeClass}">
                        <img src="${opConf.logoUrl}" class="driver-op-logo" alt="${opConf.name}">
                        <span class="driver-op-name">${opConf.name}</span>
                    </div>
                    ${coordBadge}
                `;
                opWrap.style.display = 'flex';
            } else {
                opWrap.style.display = 'none';
            }
        } else {
            opWrap.style.display = 'none';
        }
    }

    const isHelper = (currentDriver.role || '').toLowerCase() === 'helper';
    const isFixed = currentDriver.salary_type === 'fixed';
    const labelEl = document.querySelector('#kmSummaryCard .stat-label');
    if (isHelper && isFixed) {
        if (labelEl) {
            labelEl.setAttribute('data-i18n', 'dashboard.basicSalary');
            labelEl.textContent = t('dashboard.basicSalary');
        }
    } else {
        if (labelEl) {
            labelEl.setAttribute('data-i18n', 'dashboard.distanceThisMonth');
            labelEl.textContent = t('dashboard.distanceThisMonth');
        }
    }

    // Populate profile details inside the modal
    if (document.getElementById('profileRole')) {
        document.getElementById('profileRole').textContent = currentDriver.role ? (currentDriver.role.charAt(0).toUpperCase() + currentDriver.role.slice(1)) : 'Driver';
    }
    if (document.getElementById('profileOperation')) {
        if (currentDriver.operation) {
            const opKey = currentDriver.operation.toLowerCase();
            const opConf = OPERATION_CONFIG[opKey];
            const coordText = currentDriver.is_coordinator ? ' ⭐ (Coordinator)' : '';
            if (opConf) {
                document.getElementById('profileOperation').innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px;"><img src="${opConf.logoUrl}" style="width:16px;height:16px;object-fit:contain;border-radius:50%;"> <strong>${opConf.name}</strong>${coordText}</span>`;
            } else {
                document.getElementById('profileOperation').textContent = `${currentDriver.operation}${coordText}`;
            }
        } else {
            document.getElementById('profileOperation').textContent = '-';
        }
    }
    if (document.getElementById('profileContact')) {
        document.getElementById('profileContact').textContent = currentDriver.contact || '-';
    }
    if (document.getElementById('profileLicense')) {
        document.getElementById('profileLicense').textContent = currentDriver.license_number || '-';
    }
    if (document.getElementById('profileAge')) {
        document.getElementById('profileAge').textContent = formatDriverAge(currentDriver.age);
    }
    if (document.getElementById('profileAddress')) {
        document.getElementById('profileAddress').textContent = currentDriver.address || '-';
    }
    if (document.getElementById('profileSalaryType')) {
        if (currentDriver.salary_type === 'per_tip') {
            document.getElementById('profileSalaryType').textContent = `Per Tip (LKR ${parseFloat(currentDriver.per_tip_charge || 0).toFixed(2)} / trip)`;
        } else {
            const basic = parseFloat(currentDriver.basic_salary || 0).toFixed(2);
            if (isHelper) {
                document.getElementById('profileSalaryType').innerHTML = `Fixed Salary (LKR ${basic})`;
            } else {
                const limit = currentDriver.km_limit || 0;
                const rate = parseFloat(currentDriver.extra_km_rate || 0).toFixed(2);
                document.getElementById('profileSalaryType').innerHTML = `Fixed Salary (LKR ${basic})<br><small style="color: var(--text-secondary);">Limit: ${limit} km | Extra: LKR ${rate}/km</small>`;
            }
        }
    }

    // Fetch Assigned Lorry Details
    await fetchLorryAssignment();

    // Load Live Stats (KM and Estimated Earnings)
    await loadDashboardStats();

    // Initialize map
    initDriverMap();

    // Fetch and plot Kevilton distribution locations
    await loadKeviltonDistributors();

    // Subscribe to real-time weekly advance updates
    subscribeWeeklyAdvanceRealtime();
}

// Fetch staff lorry assignment (caches and handles vector art details)
async function fetchLorryAssignment() {
    const assignEl = document.getElementById('vehicleNumberDisplay');
    const modelEl = document.getElementById('vehicleModelDisplay');
    const artContainer = document.getElementById('vehicleVectorArtContainer');
    
    // Set initial loader state
    if (assignEl) assignEl.innerHTML = '<div class="skeleton skeleton-text" style="width: 50px;"></div>';
    if (modelEl) modelEl.innerHTML = '<div class="skeleton skeleton-text" style="width: 45px;"></div>';
    if (artContainer) artContainer.innerHTML = '<div class="skeleton skeleton-text" style="width: 100%; height: 24px;"></div>';
    
    driverLorry = null;
    driverLorryId = null;

    // Clear stale vehicle cache to force fresh DB lookup every time when online
    if (navigator.onLine) {
        try { safeStorageRemove('jt_driver_lorry_details'); } catch(e) {}
    }

    // Retrieve from cache if offline
    if (!navigator.onLine) {
        const cached = getCachedData('jt_driver_lorry_details');
        if (cached) {
            driverLorry = cached.lorry_number;
            driverLorryId = cached.id;
            updateVehicleCardUI(cached.lorry_number, cached.vehicle_model, cached.vector_art_url);
            return;
        }
    }

    try {
        // Use limit(1) instead of maybeSingle() to prevent PGRST116 single-row constraint errors if duplicate assignment records exist
        let query = supabaseClient
            .from('staff_lorry_assignments')
            .select('lorry_number')
            .eq('driver_id', currentDriver.id);
        
        if (currentDriver.user_id) {
            query = query.eq('user_id', currentDriver.user_id);
        }

        const { data: assignRows, error } = await query.order('id', { ascending: false }).limit(1);

        if (error) {
            console.warn('[Vehicle Debug] Assignment query error:', error.message);
        }
        
        const data = (assignRows && assignRows.length > 0) ? assignRows[0] : null;
        console.log('[Vehicle Debug] Assignment result:', data, '| driver_id:', currentDriver.id, '| user_id:', currentDriver.user_id);

        if (data && data.lorry_number) {
            driverLorry = data.lorry_number;
            
            // Now resolve vehicle model/art details in database safely using normalized plate matching
            let vehicleDetails = null;
            
            try {
                const targetClean = (driverLorry || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                console.log('[Vehicle Debug] Looking up vehicle art for:', driverLorry, '| normalized:', targetClean);

                // Fetch all vehicles from hire_to_pay_vehicles and commitment_vehicles without restricting by driver user_id
                const [hireResult, commResult] = await Promise.all([
                    supabaseClient.from('hire_to_pay_vehicles').select('id, lorry_number, vehicle_model, vector_art_url, photo_url'),
                    supabaseClient.from('commitment_vehicles').select('id, vehicle_number, vehicle_model, vector_art_url, photo_url')
                ]);

                const hireVehicles = hireResult.data;
                const commVehicles = commResult.data;

                if (hireResult.error) console.warn('[Vehicle Debug] hire_to_pay_vehicles query error:', hireResult.error.message);
                if (commResult.error) console.warn('[Vehicle Debug] commitment_vehicles query error:', commResult.error.message);

                console.log('[Vehicle Debug] hire_to_pay_vehicles count:', hireVehicles?.length || 0, '| commitment_vehicles count:', commVehicles?.length || 0);

                // Log all vehicle plates and their art URLs for debugging
                hireVehicles?.forEach(v => {
                    const clean = (v.lorry_number || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    console.log('[Vehicle Debug] Hire vehicle:', v.lorry_number, '| clean:', clean, '| vector_art_url:', v.vector_art_url ? 'SET' : 'NULL', '| photo_url:', v.photo_url ? 'SET' : 'NULL');
                });
                commVehicles?.forEach(v => {
                    const clean = (v.vehicle_number || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    console.log('[Vehicle Debug] Commitment vehicle:', v.vehicle_number, '| clean:', clean, '| vector_art_url:', v.vector_art_url ? 'SET' : 'NULL', '| photo_url:', v.photo_url ? 'SET' : 'NULL');
                });

                // Combine all candidates from hire_to_pay_vehicles and commitment_vehicles
                const candidates = [];
                hireVehicles?.forEach(v => {
                    const clean = (v.lorry_number || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    candidates.push({
                        id: v.id,
                        plate: v.lorry_number,
                        clean: clean,
                        model: v.vehicle_model,
                        artUrl: v.vector_art_url || v.photo_url || null,
                        source: 'hire'
                    });
                });
                commVehicles?.forEach(v => {
                    const clean = (v.vehicle_number || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    candidates.push({
                        id: v.id,
                        plate: v.vehicle_number,
                        clean: clean,
                        model: v.vehicle_model,
                        artUrl: v.vector_art_url || v.photo_url || null,
                        source: 'commitment'
                    });
                });

                // Score candidates to prioritize exact match + having vector art/photo
                const matchingCandidates = candidates.map(c => {
                    let score = 0;
                    const isExact = c.clean === targetClean;
                    const isPartial = c.clean && (c.clean.includes(targetClean) || targetClean.includes(c.clean));
                    const hasArt = Boolean(c.artUrl);

                    if (isExact && hasArt) score = 4;
                    else if (isPartial && hasArt) score = 3;
                    else if (isExact) score = 2;
                    else if (isPartial) score = 1;

                    return { ...c, score };
                }).filter(c => c.score > 0);

                // Sort highest score first
                matchingCandidates.sort((a, b) => b.score - a.score);

                const bestMatch = matchingCandidates.length > 0 ? matchingCandidates[0] : null;

                if (bestMatch) {
                    console.log('[Vehicle Debug] MATCHED vehicle:', bestMatch.plate, '| score:', bestMatch.score, '| art:', bestMatch.artUrl || 'NONE');
                    driverLorryId = bestMatch.id;
                    vehicleDetails = {
                        id: bestMatch.id,
                        lorry_number: driverLorry,
                        vehicle_model: bestMatch.model || 'Standard Truck',
                        vector_art_url: bestMatch.artUrl
                    };
                } else {
                    console.warn('[Vehicle Debug] NO MATCH found for:', driverLorry, '(cleaned:', targetClean, ')');
                }
            } catch (vErr) {
                console.warn('[Vehicle Debug] Vehicle details lookup warning:', vErr.message);
            }

            if (!vehicleDetails) {
                vehicleDetails = {
                    id: null,
                    lorry_number: driverLorry,
                    vehicle_model: 'Standard Truck',
                    vector_art_url: null
                };
            }

            console.log('[Vehicle Debug] Final vehicleDetails:', JSON.stringify(vehicleDetails));

            // Cache and update UI
            setCachedData('jt_driver_lorry_details', vehicleDetails);
            updateVehicleCardUI(vehicleDetails.lorry_number, vehicleDetails.vehicle_model, vehicleDetails.vector_art_url);
        } else {
            // No assignment found
            console.log('[Vehicle Debug] No assignment found for driver:', currentDriver.id);
            updateVehicleCardUI('No Vehicle', 'Not Assigned', null);
            setCachedData('jt_driver_lorry_details', null);
        }
    } catch (err) {
        console.error('[Vehicle Debug] Error fetching assignment:', err.message);
        // Fall back to cache on failure
        const cached = getCachedData('jt_driver_lorry_details');
        if (cached) {
            driverLorry = cached.lorry_number;
            driverLorryId = cached.id;
            updateVehicleCardUI(cached.lorry_number, cached.vehicle_model, cached.vector_art_url);
        } else {
            updateVehicleCardUI('Error Loading', 'Offline/Error', null);
        }
    }
}

// Update vehicle card UI helper
function updateVehicleCardUI(lorryNum, model, artUrl) {
    const assignEl = document.getElementById('vehicleNumberDisplay');
    const modelEl = document.getElementById('vehicleModelDisplay');
    const artContainer = document.getElementById('vehicleVectorArtContainer');

    if (assignEl) assignEl.textContent = lorryNum || 'Not Assigned';
    if (modelEl) modelEl.textContent = model || 'Standard';
    
    if (artContainer) {
        if (artUrl) {
            artContainer.innerHTML = `<img src="${artUrl}" alt="Vehicle" class="vehicle-art-img" onerror="this.onerror=null; this.parentElement.innerHTML=defaultLorrySVG;">`;
        } else {
            artContainer.innerHTML = defaultLorrySVG;
        }
    }
}

// Helper: Normalize vehicle names for matching
function extractBaseVehicleName(name) {
    if (!name) return '';
    const match = name.match(/([a-zA-Z0-9]{1,4})\s*-\s*([0-9]{1,4})/);
    if (match) {
        return `${match[1].trim().toUpperCase()} - ${match[2].trim()}`;
    }
    return name.trim().toUpperCase();
}

// Load Dashboard Statistics (KM & quick estimate with caching support)
async function loadDashboardStats() {
    try {
        const isHelper = (currentDriver.role || '').toLowerCase() === 'helper';
        const isFixed = currentDriver.salary_type === 'fixed';
        const unitEl = document.querySelector('#kmSummaryCard .stat-unit');

        if (isHelper && isFixed) {
            if (unitEl) unitEl.style.display = 'none';
            const basic = parseFloat(currentDriver.basic_salary || 0);
            document.getElementById('monthlyKmValue').textContent = `LKR ${basic.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            const estimateEl = document.getElementById('salaryQuickEstimate');
            if (estimateEl) estimateEl.textContent = 'TAP FOR DETAILS';
            return;
        }

        if (unitEl) unitEl.style.display = '';

        const [year, month] = activeMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        document.getElementById('monthlyKmValue').innerHTML = '<div class="skeleton skeleton-value"></div>';
        document.getElementById('salaryQuickEstimate').innerHTML = '<div class="skeleton skeleton-desc"></div>';

        if (!navigator.onLine) {
            // Load from cache
            const cached = getCachedData(`jt_driver_dashboard_stats_${activeMonth}`);
            if (cached) {
                animateNumericText('monthlyKmValue', 0, cached.totalKm, 800);
                const estimateEl = document.getElementById('salaryQuickEstimate');
                if (estimateEl) {
                    estimateEl.textContent = cached.salaryEstimateText;
                    estimateEl.style.color = cached.salaryEstimateColor;
                }
                return;
            }
        }

        // 1. Fetch KM records for current month
        const { data: kmRecs, error: kmError } = await supabaseClient
            .from('driver_km_records')
            .select('km_amount')
            .eq('driver_id', currentDriver.id)
            .eq('user_id', currentDriver.user_id)
            .gte('record_date', startDate)
            .lte('record_date', endDate);

        if (kmError) throw kmError;

        let totalKm = 0;
        if (kmRecs) {
            totalKm = kmRecs.reduce((sum, r) => sum + parseFloat(r.km_amount || 0), 0);
        }

        animateNumericText('monthlyKmValue', 0, totalKm, 800);

        // Hide salary estimate on dashboard (salary amounts not shown to drivers)
        const estimateEl = document.getElementById('salaryQuickEstimate');
        if (estimateEl) estimateEl.textContent = '';

    } catch (err) {
        console.error('Error calculating dashboard stats:', err.message);
        // Fall back to cache on failure
        const cached = getCachedData(`jt_driver_dashboard_stats_${activeMonth}`);
        if (cached) {
            animateNumericText('monthlyKmValue', 0, cached.totalKm, 800);
            const estimateEl = document.getElementById('salaryQuickEstimate');
            if (estimateEl) {
                estimateEl.textContent = cached.salaryEstimateText;
                estimateEl.style.color = cached.salaryEstimateColor;
            }
        } else {
            document.getElementById('monthlyKmValue').textContent = '-';
            document.getElementById('salaryQuickEstimate').textContent = 'Load Error';
        }
    }
}

// Initialize Leaflet Map
function initDriverMap() {
    if (driverMap) return;

    // Center map initially around Sri Lanka center
    driverMap = L.map('driverMap', {
        center: [7.8731, 80.7718],
        zoom: 7,
        zoomControl: false, // hide default buttons to customize
        attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18
    }).addTo(driverMap);

    // Zoom buttons repositioned to top right
    L.control.zoom({ position: 'topright' }).addTo(driverMap);

    // Request driver's live GPS location
    trackUserLocation(true);
}

// Track and plot user's location continuously via watchPosition
function trackUserLocation(centerMap = false) {
    if (!navigator.geolocation) {
        console.warn('Geolocation not supported by this browser');
        return;
    }

    // If already watching, center if requested, but don't start another watcher
    if (locationWatchId !== null) {
        if (centerMap && userLocationMarker && driverMap) {
            driverMap.setView(userLocationMarker.getLatLng(), 15);
        }
        return;
    }

    const options = {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000
    };

    locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;

            if (userLocationMarker) {
                userLocationMarker.setLatLng([latitude, longitude]);
            } else {
                const locationDotIcon = L.divIcon({
                    html: '<div class="pulsating-location-dot"></div>',
                    className: '',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });

                if (driverMap) {
                    userLocationMarker = L.marker([latitude, longitude], { icon: locationDotIcon }).addTo(driverMap);
                    userLocationMarker.bindPopup(`<strong>${t('map.youAreHere')}</strong>`);
                }
            }

            // Center map on first locate, or when recenter button is clicked
            if (centerMap && driverMap) {
                driverMap.setView([latitude, longitude], 15);
                centerMap = false; // reset flag so it doesn't snap center constantly
            }
        },
        (error) => {
            console.warn('Geolocation tracking error:', error.message);
            if (centerMap && driverMap) {
                // Fallback to start point
                driverMap.setView([KD_START_POINT.lat, KD_START_POINT.lng], 12);
            }
        },
        options
    );
}

// Fetch Kevilton distribution locations with caching support
async function loadKeviltonDistributors() {
    if (!navigator.onLine) {
        const cached = getCachedData('jt_driver_distributors');
        if (cached) {
            distributorsList = cached;
            plotDistributorsOnMap();
            renderDistributorsList();
            return;
        }
    }

    try {
        const { data, error } = await supabaseClient
            .from('kd_distributors')
            .select('*')
            .eq('user_id', currentDriver.user_id);

        if (error) throw error;
        
        distributorsList = data || [];
        setCachedData('jt_driver_distributors', distributorsList);
        plotDistributorsOnMap();
        renderDistributorsList();
    } catch (err) {
        console.error('Error fetching distributors:', err.message);
        const cached = getCachedData('jt_driver_distributors');
        if (cached) {
            distributorsList = cached;
            plotDistributorsOnMap();
            renderDistributorsList();
        }
    }
}

// Custom Kevilton logo marker icon
function createKeviltonIcon() {
    const size = 36;
    const html = `
        <div style="
            width:${size}px; height:${size}px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:#fff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            border: 2px solid #D1001F;
            display:flex; align-items:center; justify-content:center;
        ">
            <img src="https://i.postimg.cc/pTbqBcdz/idm2DKn-i-I.png"
                 style="width:${size * 0.65}px; height:${size * 0.65}px;
                        transform:rotate(45deg); object-fit:contain;
                        border-radius:50%;" />
        </div>`;
    return L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -(size + 4)]
    });
}

// Start point marker icon
function createStartIcon() {
    const size = 42;
    const html = `
        <div style="
            width:${size}px; height:${size}px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:#fff;
            box-shadow: 0 4px 12px rgba(0,72,180,0.5);
            border: 2.5px solid #0048B4;
            display:flex; align-items:center; justify-content:center;
        ">
            <img src="${KD_START_POINT.logoUrl}"
                 style="width:${size * 0.6}px; height:${size * 0.6}px;
                        transform:rotate(45deg); object-fit:contain;
                        border-radius:50%;" />
        </div>`;
    return L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -(size + 4)]
    });
}

// Plot markers on map
function plotDistributorsOnMap() {
    if (!driverMap) return;

    // Clear existing markers
    markers.forEach(m => m.remove());
    markers = [];

    // Add Start Point Marker
    const startMapsLink = `https://maps.google.com/?q=${KD_START_POINT.lat},${KD_START_POINT.lng}`;
    const startPopup = `
        <div class="kd-popup">
            <div class="kd-popup-name">🏭 ${KD_START_POINT.name}</div>
            <div class="kd-popup-town">📍 ${KD_START_POINT.town}</div>
            <span class="kd-popup-type type-start">Start Point</span>
            <div class="kd-popup-divider"></div>
            <div class="kd-popup-actions">
                <a class="kd-popup-navigate-btn" href="${startMapsLink}" target="_blank">
                    ${t('map.navigate')}
                </a>
            </div>
        </div>`;
    const startMarker = L.marker([KD_START_POINT.lat, KD_START_POINT.lng], { icon: createStartIcon() })
        .bindPopup(startPopup)
        .addTo(driverMap);
    markers.push(startMarker);

    // Add Distributor Markers
    distributorsList.forEach(r => {
        if (!r.lat || !r.lng) return;

        const mapsLink = `https://www.google.com/maps?q=${r.lat},${r.lng}`;
        const popupContent = `
            <div class="kd-popup">
                <div class="kd-popup-name">${r.distributor_name}</div>
                <div class="kd-popup-town">📍 ${r.town_name}</div>
                <span class="kd-popup-type type-distributor">Distributor</span>
                <div class="kd-popup-divider"></div>
                <div class="kd-popup-actions">
                    <button class="kd-popup-copy-btn" onclick="copyMapLocation('${mapsLink}', this)">
                        ${t('map.copyLink')}
                    </button>
                    <a class="kd-popup-navigate-btn" href="${mapsLink}" target="_blank">
                        ${t('map.navigate')}
                    </a>
                </div>
            </div>`;

        const marker = L.marker([r.lat, r.lng], { icon: createKeviltonIcon() })
            .bindPopup(popupContent)
            .addTo(driverMap);
        
        markers.push(marker);
    });
}

// Copy location link helper
window.copyMapLocation = function(link, btn) {
    navigator.clipboard.writeText(link).then(() => {
        const origHTML = btn.innerHTML;
        btn.innerHTML = `<span class="kd-popup-btn-icon">✅</span> ${t('map.copied')}`;
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = origHTML;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
};

// Render Kevilton distributors in the search drawer
function renderDistributorsList(filteredList = null) {
    const container = document.getElementById('distributorsList');
    if (!container) return;

    const list = filteredList || distributorsList;

    if (list.length === 0) {
        container.innerHTML = `<div class="no-results">${t('drawer.noResults')}</div>`;
        return;
    }

    container.innerHTML = '';
    list.forEach(r => {
        const mapsLink = `https://www.google.com/maps?q=${r.lat},${r.lng}`;
        const item = document.createElement('div');
        item.className = 'distributor-item';
        item.innerHTML = `
            <div class="distributor-item-details">
                <span class="distributor-item-name">${r.distributor_name}</span>
                <span class="distributor-item-town">📍 ${r.town_name}</span>
            </div>
            <div class="distributor-item-actions">
                <button class="btn-circle" title="Locate on Map" onclick="focusOnMarker(${r.lat}, ${r.lng}); event.stopPropagation();">📍</button>
                <a class="btn-circle" title="Google Maps Navigation" href="${mapsLink}" target="_blank" onclick="event.stopPropagation();" style="text-decoration:none;">🗺️</a>
            </div>
        `;
        
        item.addEventListener('click', () => {
            focusOnMarker(r.lat, r.lng, true);
        });

        container.appendChild(item);
    });
}

// Filter distributors drawer list
function filterDistributorsList(query) {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) {
        renderDistributorsList(distributorsList);
        return;
    }

    const filtered = distributorsList.filter(d => 
        d.distributor_name.toLowerCase().includes(cleanQuery) ||
        d.town_name.toLowerCase().includes(cleanQuery)
    );

    renderDistributorsList(filtered);
}

// Map helper to center on marker and pop it open
window.focusOnMarker = function(lat, lng, openPopup = false) {
    if (!driverMap) return;

    driverMap.setView([lat, lng], 15);
    
    // Close distributors drawer on select for mobile screen space
    document.getElementById('distributorDrawer').classList.remove('open');
    document.querySelector('.drawer-toggle-arrow').textContent = '▲';
    document.querySelector('.drawer-toggle-arrow').classList.remove('open');

    if (openPopup) {
        markers.forEach(m => {
            const pos = m.getLatLng();
            if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
                setTimeout(() => m.openPopup(), 400);
            }
        });
    }
};

// ==================== SALARY DETAILS SHEET ====================

function openSalaryModal() {
    const modal = document.getElementById('salaryModal');
    if (modal) {
        modal.classList.add('active');
        loadSalaryDetails();
        loadWeeklyAdvanceWidget(); // Refresh weekly widget on open
    }
}

// Close Salary modal
function closeSalaryModal() {
    const modal = document.getElementById('salaryModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Load salary details for the selected activeMonth with caching fallback
async function loadSalaryDetails() {
    try {
        const isHelper = (currentDriver.role || '').toLowerCase() === 'helper';
        const isFixed = currentDriver.salary_type === 'fixed';
        const modalKmCard = document.querySelector('#salaryModal .salary-summary-cards');
        if (modalKmCard) {
            modalKmCard.style.display = (isHelper && isFixed) ? 'none' : '';
        }

        const [year, month] = activeMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        // Reset display and show loaders
        document.getElementById('salaryFinalizedBanner').classList.add('hidden');
        document.getElementById('salaryEstimateBanner').classList.add('hidden');

        document.getElementById('modalTotalKm').innerHTML = '<div class="skeleton skeleton-value" style="width: 130px; height: 26px;"></div>';
        document.getElementById('valTotalAdvances').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valTotalDayOffs').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';
        document.getElementById('valTotalDeductions').innerHTML = '<div class="skeleton skeleton-text" style="width: 80px;"></div>';

        document.getElementById('advancesListContainer').innerHTML = '<div style="padding: 14px; text-align: center;"><div class="skeleton skeleton-desc" style="width: 100%;"></div></div>';
        document.getElementById('dayOffsListContainer').innerHTML = '<div style="padding: 14px; text-align: center;"><div class="skeleton skeleton-desc" style="width: 100%;"></div></div>';
        document.getElementById('deductionsListContainer').innerHTML = '<div style="padding: 14px; text-align: center;"><div class="skeleton skeleton-desc" style="width: 100%;"></div></div>';

        // Always clear stale cached salary details to ensure fresh data
        safeStorageRemove(`jt_driver_salary_details_${activeMonth}`);

        if (!navigator.onLine) {
            const cached = getCachedData(`jt_driver_salary_details_${activeMonth}`);
            if (cached) {
                if (cached.isFinalized) {
                    displayFinalizedSalary(cached.record);
                } else {
                    displayLiveEstimatedSalaryFromCache(cached.data);
                }
                return;
            }
        }

        // Fetch finalized salary slip
        const { data: salaryRecord, error: salaryError } = await supabaseClient
            .from('driver_salary')
            .select('*')
            .eq('driver_id', currentDriver.id)
            .eq('user_id', currentDriver.user_id)
            .eq('salary_month', activeMonth)
            .maybeSingle();

        if (salaryError) throw salaryError;

        if (salaryRecord) {
            // Case 1: Finalized Salary Slip exists
            displayFinalizedSalary(salaryRecord);
            // Cache record
            setCachedData(`jt_driver_salary_details_${activeMonth}`, {
                isFinalized: true,
                record: salaryRecord
            });
        } else {
            // Case 2: Live Estimate (not finalized)
            const liveData = await displayLiveEstimatedSalary(startDate, endDate);
            // Cache live breakdown data
            setCachedData(`jt_driver_salary_details_${activeMonth}`, {
                isFinalized: false,
                data: liveData
            });
        }
    } catch (err) {
        console.error('Error loading salary details:', err.message);
        
        // Try fallback to cache
        const cached = getCachedData(`jt_driver_salary_details_${activeMonth}`);
        if (cached) {
            if (cached.isFinalized) {
                displayFinalizedSalary(cached.record);
            } else {
                displayLiveEstimatedSalaryFromCache(cached.data);
            }
        } else {
            showDriverToast('Failed to load salary details: ' + err.message, 'error');
        }
    }
}

// Display finalized salary info
function displayFinalizedSalary(record) {
    const fb = document.getElementById('salaryFinalizedBanner');
    fb.classList.remove('hidden');

    // Show Total KM
    const salaryData = record.salary_data || {};
    const totalKm = parseFloat(salaryData.totalKm || record.km_driven || 0);
    const kmEl = document.getElementById('modalTotalKm');
    if (kmEl) kmEl.textContent = `${totalKm.toFixed(2)} km`;

    // Deductions Summary
    document.getElementById('valTotalAdvances').textContent = `LKR ${parseFloat(record.total_advances || 0).toFixed(2)}`;
    
    const dayOffDeductions = parseFloat(salaryData.dayOffDeductions || 0);
    document.getElementById('valTotalDayOffs').textContent = `LKR ${dayOffDeductions.toFixed(2)}`;
    document.getElementById('valTotalDeductions').textContent = `LKR ${parseFloat(record.other_deductions || 0).toFixed(2)}`;

    // Lists
    renderAdvancesList(salaryData.advances || []);
    renderDayOffsList(salaryData.dayOffRecords || []);
    renderDeductionsList(salaryData.deductions || []);
}

// Display live estimated values
async function displayLiveEstimatedSalary(startDate, endDate) {
    document.getElementById('salaryEstimateBanner').classList.remove('hidden');

    // Fetch live data from individual tables
    const [
        { data: kmRecs, error: errKm },
        { data: advances, error: errAdv },
        { data: dayOffs, error: errDo },
        { data: deductions, error: errDed }
    ] = await Promise.all([
        supabaseClient.from('driver_km_records').select('km_amount').eq('driver_id', currentDriver.id).eq('user_id', currentDriver.user_id).gte('record_date', startDate).lte('record_date', endDate),
        supabaseClient.from('driver_advances').select('*').eq('driver_id', currentDriver.id).eq('user_id', currentDriver.user_id).gte('advance_date', startDate).lte('advance_date', endDate),
        supabaseClient.from('driver_day_offs').select('*').eq('driver_id', currentDriver.id).eq('user_id', currentDriver.user_id).gte('day_off_date', startDate).lte('day_off_date', endDate),
        supabaseClient.from('staff_deductions').select('*').eq('driver_id', currentDriver.id).eq('user_id', currentDriver.user_id).eq('salary_month', activeMonth)
    ]);

    if (errKm) throw errKm;
    if (errAdv) throw errAdv;
    if (errDo) throw errDo;
    if (errDed) throw errDed;

    let tripCount = 0;
    if (currentDriver.salary_type === 'per_tip' && driverLorryId) {
        const [{ count: hireCount }, { count: commCount }] = await Promise.all([
            supabaseClient.from('hire_to_pay_records').select('*', { count: 'exact', head: true }).eq('vehicle_id', driverLorryId).eq('user_id', currentDriver.user_id).gte('hire_date', startDate).lte('hire_date', endDate),
            supabaseClient.from('commitment_records').select('*', { count: 'exact', head: true }).eq('vehicle_id', driverLorryId).eq('user_id', currentDriver.user_id).gte('hire_date', startDate).lte('hire_date', endDate)
        ]);
        tripCount = (hireCount || 0) + (commCount || 0);
    }

    const liveData = { kmRecs, advances, dayOffs, deductions, tripCount };
    renderLiveEstimatedSalaryUI(liveData, startDate, endDate);
    return liveData;
}

function displayLiveEstimatedSalaryFromCache(liveData) {
    document.getElementById('salaryEstimateBanner').classList.remove('hidden');
    const [year, month] = activeMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    renderLiveEstimatedSalaryUI(liveData, startDate, endDate);
}

function renderLiveEstimatedSalaryUI(liveData, startDate, endDate) {
    if (!liveData) return;
    const { kmRecs, advances, dayOffs, deductions } = liveData;
    
    const totalKm = Array.isArray(kmRecs) ? kmRecs.reduce((sum, r) => sum + parseFloat(r.km_amount || 0), 0) : 0;
    const totalAdvances = Array.isArray(advances) ? advances.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0) : 0;
    const totalDayOffs = Array.isArray(dayOffs) ? dayOffs.reduce((sum, d) => sum + parseFloat(d.deduction_amount || 0), 0) : 0;
    const totalDeductions = Array.isArray(deductions) ? deductions.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0) : 0;

    // Show Total KM
    const kmEl = document.getElementById('modalTotalKm');
    if (kmEl) kmEl.textContent = `${totalKm.toFixed(2)} km`;

    // Display advance/dayoff/deduction totals
    document.getElementById('valTotalAdvances').textContent = `LKR ${totalAdvances.toFixed(2)}`;
    document.getElementById('valTotalDayOffs').textContent = `LKR ${totalDayOffs.toFixed(2)}`;
    document.getElementById('valTotalDeductions').textContent = `LKR ${totalDeductions.toFixed(2)}`;

    // Render individual item lists
    renderAdvancesList(advances || []);
    renderDayOffsList(dayOffs || []);
    renderDeductionsList(deductions || []);
}

// Toggle layout rows between fixed salary and per-tip
function toggleSalaryTypeRows(isFixed) {
    const fixedRowBasic = document.getElementById('rowBasicSalary');
    const fixedRowExtra = document.getElementById('rowExtraKm');
    const perTipRow = document.getElementById('rowTipSalary');

    if (isFixed) {
        fixedRowBasic.style.display = 'flex';
        fixedRowExtra.style.display = 'flex';
        perTipRow.style.display = 'none';
    } else {
        fixedRowBasic.style.display = 'none';
        fixedRowExtra.style.display = 'none';
        perTipRow.style.display = 'flex';
    }
}

// Sub list renderers
function renderAdvancesList(list) {
    const container = document.getElementById('advancesListContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="sub-list-item" style="font-style:italic;color:var(--text-muted);">${t('salary.noAdvances')}</div>`;
        return;
    }

    container.innerHTML = '';
    list.forEach(a => {
        const item = document.createElement('div');
        item.className = 'sub-list-item';
        item.innerHTML = `
            <div>
                <span class="sub-list-date">${a.advance_date}</span>
                ${a.notes ? `<span class="sub-list-note">(${a.notes})</span>` : ''}
            </div>
            <span class="sub-list-amount">- LKR ${parseFloat(a.amount).toFixed(2)}</span>
        `;
        container.appendChild(item);
    });
}

function renderDayOffsList(list) {
    const container = document.getElementById('dayOffsListContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="sub-list-item" style="font-style:italic;color:var(--text-muted);">${t('salary.noDayOffs')}</div>`;
        return;
    }

    container.innerHTML = '';
    list.forEach(d => {
        const item = document.createElement('div');
        item.className = 'sub-list-item';
        item.innerHTML = `
            <div>
                <span class="sub-list-date">${d.day_off_date}</span>
                ${d.notes ? `<span class="sub-list-note">(${d.notes})</span>` : ''}
            </div>
            <span class="sub-list-amount">- LKR ${parseFloat(d.deduction_amount).toFixed(2)}</span>
        `;
        container.appendChild(item);
    });
}

function renderDeductionsList(list) {
    const container = document.getElementById('deductionsListContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="sub-list-item" style="font-style:italic;color:var(--text-muted);">${t('salary.noDeductions')}</div>`;
        return;
    }

    container.innerHTML = '';
    list.forEach(d => {
        const item = document.createElement('div');
        item.className = 'sub-list-item';
        item.innerHTML = `
            <div>
                <span class="sub-list-date">${d.deduction_date}</span>
                ${d.reason ? `<span class="sub-list-note">(${d.reason})</span>` : ''}
            </div>
            <span class="sub-list-amount">- LKR ${parseFloat(d.amount).toFixed(2)}</span>
        `;
        container.appendChild(item);
    });
}

// ==================== WEEKLY ADVANCE LIMIT WIDGET ====================

const WEEKLY_ADVANCE_LIMIT = 7000; // LKR 7,000 per week

/**
 * Returns the Monday and Sunday of the current ISO week as YYYY-MM-DD strings.
 */
function getWeekBounds() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diffToMonday = (day === 0) ? -6 : 1 - day; // Monday is start
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };
    return { start: fmt(monday), end: fmt(sunday) };
}

/**
 * Returns how many days until next Monday (0 = today is Monday).
 */
function daysUntilMonday() {
    const day = new Date().getDay(); // 0=Sun, 1=Mon,...
    if (day === 1) return 0; // Today is Monday
    return day === 0 ? 1 : 8 - day;
}

/**
 * Fetch this week's advances and update the widget UI.
 */
async function loadWeeklyAdvanceWidget() {
    const widget = document.getElementById('weeklyAdvanceWidget');
    if (!widget || !currentDriver) return;

    // Family drivers (JAUK / JAAP Jayasooriya) have no weekly advance limit — hide widget
    const driverNameLower = (currentDriver.name || currentDriver.nickname || '').toLowerCase();
    const isFamilyDriver = ['jauk', 'jaap'].some(k => driverNameLower.includes(k));
    if (isFamilyDriver) {
        widget.style.display = 'none';
        return;
    }
    widget.style.display = ''; // ensure visible for other drivers

    // Show skeleton state
    const remainingEl = document.getElementById('wawRemaining');
    const usedEl = document.getElementById('wawUsedOf');
    if (remainingEl) remainingEl.textContent = 'Loading...';
    if (usedEl) usedEl.textContent = '';

    try {
        const { start, end } = getWeekBounds();

        let weeklyUsed = 0;

        if (!navigator.onLine) {
            // Offline: use cached value
            weeklyUsed = getCachedData('jt_driver_weekly_advance') || 0;
        } else {
            const { data, error } = await supabaseClient
                .from('driver_advances')
                .select('amount')
                .eq('driver_id', currentDriver.id)
                .eq('user_id', currentDriver.user_id)
                .gte('advance_date', start)
                .lte('advance_date', end);

            if (error) throw error;

            weeklyUsed = (data || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
            setCachedData('jt_driver_weekly_advance', weeklyUsed);
        }

        updateWeeklyAdvanceUI(weeklyUsed, WEEKLY_ADVANCE_LIMIT);

    } catch (err) {
        console.warn('Weekly advance widget error:', err.message);
        const cached = getCachedData('jt_driver_weekly_advance');
        updateWeeklyAdvanceUI(cached || 0, WEEKLY_ADVANCE_LIMIT);
    }
}

/**
 * Update the widget DOM elements with the given used/limit values.
 */
function updateWeeklyAdvanceUI(used, limit) {
    const widget = document.getElementById('weeklyAdvanceWidget');
    const arcEl = document.getElementById('wawRingArc');
    const pctEl = document.getElementById('wawPct');
    const remainingEl = document.getElementById('wawRemaining');
    const usedEl = document.getElementById('wawUsedOf');
    const daysEl = document.getElementById('wawDaysLeft');

    if (!widget || !arcEl) return;

    const remaining = Math.max(0, limit - used);
    const usedClamped = Math.min(used, limit);
    const pct = Math.round((remaining / limit) * 100);

    // SVG arc: circumference = 2 * PI * r (r=38)
    const circumference = 2 * Math.PI * 38; // ≈ 238.76
    const fillDash = (usedClamped / limit) * circumference;
    const remainDash = circumference - fillDash;

    // Animate arc: we show remaining as the filled portion
    const remainFill = (remaining / limit) * circumference;
    arcEl.style.strokeDasharray = `${remainFill} ${circumference - remainFill}`;

    // Update percentage text
    if (pctEl) pctEl.textContent = `${pct}%`;

    // Update amounts
    const fmtLKR = (val) => `LKR ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (remainingEl) {
        remainingEl.textContent = remaining <= 0 ? t('advance.limitReached') : fmtLKR(remaining);
    }
    if (usedEl) {
        usedEl.textContent = `${fmtLKR(used)} ${t('advance.usedOf')} ${fmtLKR(limit)}`;
    }

    // Update reset countdown
    if (daysEl) {
        const days = daysUntilMonday();
        if (days === 0) {
            daysEl.textContent = t('advance.today');
        } else if (days === 1) {
            daysEl.textContent = `${t('advance.resetsIn')} 1 ${t('advance.day')}`;
        } else {
            daysEl.textContent = `${t('advance.resetsIn')} ${days} ${t('advance.days')}`;
        }
    }

    // Apply colour state
    widget.classList.remove('waw-green', 'waw-amber', 'waw-red');
    if (remaining >= 3500) {
        widget.classList.add('waw-green');
    } else if (remaining >= 1000) {
        widget.classList.add('waw-amber');
    } else {
        widget.classList.add('waw-red');
    }
}

/**
 * Subscribe to Supabase Realtime for live weekly advance updates.
 * Updates the widget whenever admin adds/edits/deletes an advance for this driver.
 */
function subscribeWeeklyAdvanceRealtime() {
    if (!supabaseClient || !currentDriver) return;

    // Skip realtime subscription for family drivers (no weekly limit applies)
    const nameLower = (currentDriver.name || currentDriver.nickname || '').toLowerCase();
    if (['jauk', 'jaap'].some(k => nameLower.includes(k))) return;

    unsubscribeWeeklyAdvance(); // clean up any existing channel

    weeklyAdvanceChannel = supabaseClient
        .channel(`weekly_advance_${currentDriver.id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'driver_advances',
            filter: `driver_id=eq.${currentDriver.id}`
        }, (payload) => {
            console.log('Weekly advance realtime update:', payload.eventType);
            loadWeeklyAdvanceWidget();
        })
        .subscribe((status) => {
            console.log('Weekly advance channel status:', status);
        });
}

/**
 * Unsubscribe and clean up the Realtime channel.
 */
function unsubscribeWeeklyAdvance() {
    if (weeklyAdvanceChannel && supabaseClient) {
        supabaseClient.removeChannel(weeklyAdvanceChannel);
        weeklyAdvanceChannel = null;
    }
}

// Helper: Animate numeric text elements
function animateNumericText(elementId, start, end, duration, prefix = "", suffix = "") {
    const el = document.getElementById(elementId);
    if (!el) return;
    const range = end - start;
    const startTime = performance.now();
    
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress * (2 - progress); // quadratic ease-out
        const current = start + range * ease;
        
        el.textContent = `${prefix}${current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// ==================== DRIVER RACE Standings ====================

function openRaceModal() {
    const modal = document.getElementById('raceModal');
    if (modal) {
        modal.classList.add('active');
        loadDriverRace();
    }
}

function closeRaceModal() {
    const modal = document.getElementById('raceModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Load race rankings with caching support
async function loadDriverRace() {
    const listContainer = document.getElementById('raceList');
    const loadingEl = document.getElementById('raceLoading');
    const labelEl = document.getElementById('raceMonthLabel');
    
    if (!listContainer || !loadingEl) return;

    // Show loading state, hide list
    loadingEl.classList.remove('hidden');
    listContainer.classList.add('hidden');
    listContainer.innerHTML = '';

    const now = new Date();
    // Format label strictly using 2026, e.g., "June 2026 Standings"
    const displayDate = new Date(2026, now.getMonth(), 1);
    const monthName = displayDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (labelEl) labelEl.textContent = `${monthName} ${t('race.standings')}`;

    if (!navigator.onLine) {
        const cached = getCachedData('jt_driver_race_standings');
        if (cached) {
            renderRaceListUI(cached.rankedDrivers, cached.maxKm, cached.helpers || []);
            loadingEl.classList.add('hidden');
            listContainer.classList.remove('hidden');
            return;
        }
    }

    try {
        // Use current calendar month for the race, strictly restricted to 2026
        const year = 2026;
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        // 1. Fetch active drivers and helpers with operation details
        const { data: drivers, error: driverError } = await supabaseClient
            .from('drivers')
            .select('id, name, photo_url, role, created_at, operation, is_coordinator')
            .eq('user_id', currentDriver.user_id)
            .neq('terminated', true);

        if (driverError) throw driverError;

        // 2. Fetch driver km records for current month
        const { data: kmRecords, error: kmError } = await supabaseClient
            .from('driver_km_records')
            .select('driver_id, km_amount')
            .eq('user_id', currentDriver.user_id)
            .gte('record_date', startDate)
            .lte('record_date', endDate);

        if (kmError) throw kmError;

        // 3. Fetch all vehicle assignments for this user's drivers
        const { data: allAssignments } = await supabaseClient
            .from('staff_lorry_assignments')
            .select('driver_id, lorry_number')
            .eq('user_id', currentDriver.user_id)
            .order('id', { ascending: false });

        // Build map: driver_id -> lorry_number (latest assignment per driver)
        const lorryByDriver = {};
        (allAssignments || []).forEach(a => {
            if (!lorryByDriver[a.driver_id]) {
                lorryByDriver[a.driver_id] = a.lorry_number;
            }
        });

        // 4. Fetch vehicle model + art info from both vehicle tables
        const [hireVehiclesResult, commVehiclesResult] = await Promise.all([
            supabaseClient.from('hire_to_pay_vehicles').select('lorry_number, vehicle_model, vector_art_url, photo_url'),
            supabaseClient.from('commitment_vehicles').select('vehicle_number, vehicle_model, vector_art_url, photo_url')
        ]);

        // Build normalized plate -> {model, artUrl} maps
        const modelByPlateNorm = {};
        const artByPlateNorm = {};
        (hireVehiclesResult.data || []).forEach(v => {
            const key = (v.lorry_number || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (key) {
                modelByPlateNorm[key] = v.vehicle_model;
                artByPlateNorm[key] = v.vector_art_url || v.photo_url || null;
            }
        });
        (commVehiclesResult.data || []).forEach(v => {
            const key = (v.vehicle_number || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (key) {
                if (!modelByPlateNorm[key]) modelByPlateNorm[key] = v.vehicle_model;
                if (!artByPlateNorm[key]) artByPlateNorm[key] = v.vector_art_url || v.photo_url || null;
            }
        });

        // Helpers: get model / art URL from plate
        function getModelForPlate(plate) {
            if (!plate) return null;
            const key = plate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            return modelByPlateNorm[key] || null;
        }
        function getArtForPlate(plate) {
            if (!plate) return null;
            const key = plate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            return artByPlateNorm[key] || null;
        }

        // Sum up km per driver
        const kmByDriver = {};
        kmRecords?.forEach(r => {
            kmByDriver[r.driver_id] = (kmByDriver[r.driver_id] || 0) + parseFloat(r.km_amount || 0);
        });

        // Filter: only role === 'driver', exclude 'JAAP Jayasooriya' & 'JAUK Jayasooriya'
        const rankedDrivers = (drivers || [])
            .filter(d => {
                if ((d.role || '').toLowerCase() !== 'driver') return false;
                const nameClean = cleanDriverName(d.name).toLowerCase();
                if (nameClean === 'jaap jayasooriya' || nameClean === 'jauk jayasooriya') return false;
                return true;
            })
            .map(d => {
                const lorryNum = lorryByDriver[d.id] || null;
                return {
                    ...d,
                    totalKm: kmByDriver[d.id] || 0,
                    vehiclePlate: lorryNum,
                    vehicleModel: getModelForPlate(lorryNum),
                    vehicleArtUrl: getArtForPlate(lorryNum)
                };
            });

        // Filter: only role === 'helper', exclude family members
        const helpers = (drivers || [])
            .filter(d => {
                if ((d.role || '').toLowerCase() !== 'helper') return false;
                const nameClean = cleanDriverName(d.name).toLowerCase();
                if (nameClean === 'jaap jayasooriya' || nameClean === 'jauk jayasooriya') return false;
                return true;
            })
            .map(d => {
                const lorryNum = lorryByDriver[d.id] || null;
                return {
                    ...d,
                    vehiclePlate: lorryNum,
                    vehicleModel: getModelForPlate(lorryNum),
                    vehicleArtUrl: getArtForPlate(lorryNum)
                };
            });

        if (rankedDrivers.length === 0 && helpers.length === 0) {
            listContainer.innerHTML = `<div class="no-results">${t('race.noDrivers')}</div>`;
            loadingEl.classList.add('hidden');
            listContainer.classList.remove('hidden');
            // Cache empty standings
            setCachedData('jt_driver_race_standings', { rankedDrivers: [], maxKm: 1, helpers: [] });
            return;
        }

        rankedDrivers.sort((a, b) => b.totalKm - a.totalKm);

        const maxKm = rankedDrivers.length > 0 ? (rankedDrivers[0].totalKm || 1) : 1;

        // Cache standings
        setCachedData('jt_driver_race_standings', { rankedDrivers, maxKm, helpers });

        renderRaceListUI(rankedDrivers, maxKm, helpers);

        loadingEl.classList.add('hidden');
        listContainer.classList.remove('hidden');

    } catch (err) {
        console.error('Error loading driver race:', err.message);
        
        // Fallback to cache on error
        const cached = getCachedData('jt_driver_race_standings');
        if (cached) {
            renderRaceListUI(cached.rankedDrivers, cached.maxKm, cached.helpers || []);
        } else {
            listContainer.innerHTML = `<div class="no-results" style="color:var(--brand-red);">${t('race.failed')}${err.message}</div>`;
        }
        loadingEl.classList.add('hidden');
        listContainer.classList.remove('hidden');
    }
}

// Render race rank items helper
function renderRaceListUI(rankedDrivers, maxKm, helpers = []) {
    const listContainer = document.getElementById('raceList');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (rankedDrivers.length === 0 && helpers.length === 0) {
        listContainer.innerHTML = `<div class="no-results">${t('race.noDrivers')}</div>`;
        return;
    }

    // Helper to determine if staff member is new (tenure <= 30 days)
    function isNewStaff(createdAtStr) {
        if (!createdAtStr) return false;
        const createdAt = new Date(createdAtStr);
        const now = new Date();
        const diffTime = Math.abs(now - createdAt);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
    }

    if (rankedDrivers.length > 0) {
        rankedDrivers.forEach((d, index) => {
            const rank = index + 1;
            const isCurrentUser = d.id === currentDriver.id;
            
            let rankHtml = '';
            if (rank === 1) {
                rankHtml = '<span class="race-rank-medal">🥇</span>';
            } else if (rank === 2) {
                rankHtml = '<span class="race-rank-medal">🥈</span>';
            } else if (rank === 3) {
                rankHtml = '<span class="race-rank-medal">🥉</span>';
            } else {
                rankHtml = `<span class="race-rank-number">#${rank}</span>`;
            }

            // Initials Fallback for Avatar
            const cleanedName = cleanDriverName(d.name);
            const initials = cleanedName ? cleanedName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() : '?';
            const avatarHtml = d.photo_url 
                ? `<img class="race-avatar-img" src="${d.photo_url}" alt="${cleanedName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="race-avatar-fallback" style="display:none;">${initials}</div>`
                : `<div class="race-avatar-fallback">${initials}</div>`;

            const progressPercent = Math.min(100, (d.totalKm / maxKm) * 100);
            const isNew = isNewStaff(d.created_at);

            let opBadgeHtml = '';
            if (d.operation) {
                const opKey = d.operation.toLowerCase();
                const opConf = OPERATION_CONFIG[opKey];
                if (opConf) {
                    opBadgeHtml = `<span class="race-badge race-badge-op ${opConf.badgeClass}"><img src="${opConf.logoUrl}" class="race-op-logo-mini" alt="${opConf.name}">${opConf.name}</span>`;
                }
            }

            // Vehicle right-panel HTML (shown in right column)
            const truckSVG = `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" class="race-truck-svg">
  <defs>
    <linearGradient id="raceBoxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2a3045"/>
      <stop offset="100%" stop-color="#1a2035"/>
    </linearGradient>
    <linearGradient id="raceCabGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3a4560"/>
      <stop offset="100%" stop-color="#252d45"/>
    </linearGradient>
    <linearGradient id="raceGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <!-- Shadow -->
  <ellipse cx="40" cy="37" rx="34" ry="2.5" fill="rgba(0,0,0,0.4)"/>
  <!-- Cargo Box -->
  <rect x="5" y="8" width="40" height="22" rx="2" fill="url(#raceBoxGrad)" stroke="rgba(255,179,0,0.3)" stroke-width="0.8"/>
  <!-- Box stripe -->
  <rect x="5" y="16" width="40" height="1.5" fill="rgba(255,179,0,0.2)"/>
  <!-- Cab -->
  <path d="M 45,14 L 58,14 Q 68,14 72,20 L 75,28 Q 76,31 73,33 L 45,33 Z" fill="url(#raceCabGrad)" stroke="rgba(255,179,0,0.25)" stroke-width="0.8"/>
  <!-- Windshield -->
  <path d="M 58,15.5 L 66,15.5 Q 70,15.5 72,20 L 73,25 L 58,25 Z" fill="url(#raceGlassGrad)" opacity="0.85"/>
  <!-- Side window -->
  <rect x="48" y="17" width="8" height="7" rx="1" fill="url(#raceGlassGrad)" opacity="0.7"/>
  <!-- Headlight -->
  <rect x="73" y="27" width="4" height="4" rx="0.8" fill="#FEF9C3"/>
  <rect x="74" y="28" width="2.5" height="2.5" rx="0.4" fill="#FBBF24"/>
  <!-- Chassis -->
  <rect x="8" y="32" width="62" height="2" fill="#1a1a2e"/>
  <!-- Wheels -->
  <circle cx="18" cy="34" r="5" fill="#0f172a" stroke="rgba(255,179,0,0.5)" stroke-width="1.2"/>
  <circle cx="18" cy="34" r="2.2" fill="#334155"/>
  <circle cx="18" cy="34" r="0.9" fill="#0f172a"/>
  <circle cx="32" cy="34" r="5" fill="#0f172a" stroke="rgba(255,179,0,0.5)" stroke-width="1.2"/>
  <circle cx="32" cy="34" r="2.2" fill="#334155"/>
  <circle cx="32" cy="34" r="0.9" fill="#0f172a"/>
  <circle cx="62" cy="34" r="5" fill="#0f172a" stroke="rgba(255,179,0,0.5)" stroke-width="1.2"/>
  <circle cx="62" cy="34" r="2.2" fill="#334155"/>
  <circle cx="62" cy="34" r="0.9" fill="#0f172a"/>
</svg>`;

            // Build vehicle art element: real image if we have a URL, SVG fallback otherwise
            function buildVehicleArt(artUrl, isSVGFallback) {
                if (artUrl) {
                    return `<img src="${artUrl}" class="race-truck-img" alt="vehicle" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
                            <div style="display:none;" class="race-truck-svg-wrap">${isSVGFallback}</div>`;
                }
                return `<div class="race-truck-svg-wrap">${isSVGFallback}</div>`;
            }

            const vehiclePanelHtml = d.vehiclePlate
                ? `<div class="race-vehicle-panel">
                       <div class="race-truck-wrap">${buildVehicleArt(d.vehicleArtUrl, truckSVG)}</div>
                       <div class="race-vehicle-info">
                           <span class="race-vehicle-plate-badge">${d.vehiclePlate}</span>
                           ${d.vehicleModel ? `<span class="race-vehicle-model-text" title="${d.vehicleModel}">${d.vehicleModel}</span>` : ''}
                       </div>
                   </div>`
                : `<div class="race-vehicle-panel race-vehicle-panel--empty">
                       <div class="race-truck-wrap">${buildVehicleArt(d.vehicleArtUrl, truckSVG)}</div>
                   </div>`;

            const card = document.createElement('div');
            card.className = `race-item rank-${rank} ${isCurrentUser ? 'current-user' : ''}`;
            card.innerHTML = `
                <div class="race-left">
                    <div class="race-rank-container">${rankHtml}</div>
                    <div class="race-avatar-container">${avatarHtml}</div>
                    <div class="race-details">
                        <div class="race-name-line">
                            <span class="race-name">${cleanedName}</span>
                            ${isCurrentUser ? `<span class="race-badge-you">${t('race.you')}</span>` : ''}
                        </div>
                        <div class="race-km-line">
                            <span class="race-value">${d.totalKm.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                            <span class="race-value-unit">KM</span>
                        </div>
                        <div class="race-meta-row">
                            <span class="race-badge race-badge-driver">${t('race.driver')}</span>
                            ${opBadgeHtml}
                            ${isNew ? `<span class="race-badge race-badge-new">${t('race.new')}</span>` : ''}
                        </div>
                        <div class="race-progress-bg">
                            <div class="race-progress-bar" style="width: 0%;"></div>
                        </div>
                    </div>
                </div>
                ${vehiclePanelHtml}
            `;

            listContainer.appendChild(card);

            // Animate progress bar width slightly after appending for smooth micro-animation
            setTimeout(() => {
                const bar = card.querySelector('.race-progress-bar');
                if (bar) bar.style.width = `${progressPercent}%`;
            }, 100);
        });
    }

    if (helpers.length > 0) {
        // Section Header for Helpers
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'race-section-header';
        sectionHeader.innerHTML = `<span data-i18n="race.helpers">${t('race.helpers')}</span>`;
        listContainer.appendChild(sectionHeader);

        helpers.forEach((d) => {
            const isCurrentUser = d.id === currentDriver.id;
            
            // Initials Fallback for Avatar
            const cleanedName = cleanDriverName(d.name);
            const initials = cleanedName ? cleanedName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() : '?';
            const avatarHtml = d.photo_url 
                ? `<img class="race-avatar-img" src="${d.photo_url}" alt="${cleanedName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="race-avatar-fallback" style="display:none;">${initials}</div>`
                : `<div class="race-avatar-fallback">${initials}</div>`;

            const isNew = isNewStaff(d.created_at);

            let opBadgeHtml = '';
            if (d.operation) {
                const opKey = d.operation.toLowerCase();
                const opConf = OPERATION_CONFIG[opKey];
                if (opConf) {
                    opBadgeHtml = `<span class="race-badge race-badge-op ${opConf.badgeClass}"><img src="${opConf.logoUrl}" class="race-op-logo-mini" alt="${opConf.name}">${opConf.name}</span>`;
                }
            }

            // Vehicle right-panel for helper
            const helperTruckSVG = `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" class="race-truck-svg">
  <defs>
    <linearGradient id="raceBoxGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2a2a45"/>
      <stop offset="100%" stop-color="#1a1a35"/>
    </linearGradient>
    <linearGradient id="raceCabGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3a3560"/>
      <stop offset="100%" stop-color="#252545"/>
    </linearGradient>
    <linearGradient id="raceGlassGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <ellipse cx="40" cy="37" rx="34" ry="2.5" fill="rgba(0,0,0,0.4)"/>
  <rect x="5" y="8" width="40" height="22" rx="2" fill="url(#raceBoxGrad2)" stroke="rgba(168,85,247,0.3)" stroke-width="0.8"/>
  <rect x="5" y="16" width="40" height="1.5" fill="rgba(168,85,247,0.2)"/>
  <path d="M 45,14 L 58,14 Q 68,14 72,20 L 75,28 Q 76,31 73,33 L 45,33 Z" fill="url(#raceCabGrad2)" stroke="rgba(168,85,247,0.25)" stroke-width="0.8"/>
  <path d="M 58,15.5 L 66,15.5 Q 70,15.5 72,20 L 73,25 L 58,25 Z" fill="url(#raceGlassGrad2)" opacity="0.85"/>
  <rect x="48" y="17" width="8" height="7" rx="1" fill="url(#raceGlassGrad2)" opacity="0.7"/>
  <rect x="73" y="27" width="4" height="4" rx="0.8" fill="#FEF9C3"/>
  <rect x="74" y="28" width="2.5" height="2.5" rx="0.4" fill="#FBBF24"/>
  <rect x="8" y="32" width="62" height="2" fill="#1a1a2e"/>
  <circle cx="18" cy="34" r="5" fill="#0f172a" stroke="rgba(168,85,247,0.5)" stroke-width="1.2"/>
  <circle cx="18" cy="34" r="2.2" fill="#334155"/>
  <circle cx="18" cy="34" r="0.9" fill="#0f172a"/>
  <circle cx="32" cy="34" r="5" fill="#0f172a" stroke="rgba(168,85,247,0.5)" stroke-width="1.2"/>
  <circle cx="32" cy="34" r="2.2" fill="#334155"/>
  <circle cx="32" cy="34" r="0.9" fill="#0f172a"/>
  <circle cx="62" cy="34" r="5" fill="#0f172a" stroke="rgba(168,85,247,0.5)" stroke-width="1.2"/>
  <circle cx="62" cy="34" r="2.2" fill="#334155"/>
  <circle cx="62" cy="34" r="0.9" fill="#0f172a"/>
</svg>`;

            const helperVehiclePanelHtml = d.vehiclePlate
                ? `<div class="race-vehicle-panel race-vehicle-panel--helper">
                       <div class="race-truck-wrap">${buildVehicleArt(d.vehicleArtUrl, helperTruckSVG)}</div>
                       <div class="race-vehicle-info">
                           <span class="race-vehicle-plate-badge">${d.vehiclePlate}</span>
                           ${d.vehicleModel ? `<span class="race-vehicle-model-text" title="${d.vehicleModel}">${d.vehicleModel}</span>` : ''}
                       </div>
                   </div>`
                : `<div class="race-vehicle-panel race-vehicle-panel--empty race-vehicle-panel--helper">
                       <div class="race-truck-wrap">${buildVehicleArt(d.vehicleArtUrl, helperTruckSVG)}</div>
                   </div>`;

            const card = document.createElement('div');
            card.className = `race-item helper-item ${isCurrentUser ? 'current-user' : ''}`;
            card.innerHTML = `
                <div class="race-left">
                    <div class="race-rank-container"><span class="race-rank-number">🤝</span></div>
                    <div class="race-avatar-container">${avatarHtml}</div>
                    <div class="race-details">
                        <div class="race-name-line">
                            <span class="race-name">${cleanedName}</span>
                            ${isCurrentUser ? `<span class="race-badge-you">${t('race.you')}</span>` : ''}
                        </div>
                        <div class="race-meta-row">
                            <span class="race-badge race-badge-helper">${t('race.helper')}</span>
                            ${opBadgeHtml}
                            ${isNew ? `<span class="race-badge race-badge-new">${t('race.new')}</span>` : ''}
                        </div>
                    </div>
                </div>
                ${helperVehiclePanelHtml}
            `;

            listContainer.appendChild(card);
        });
    }
}

// Start everything when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
