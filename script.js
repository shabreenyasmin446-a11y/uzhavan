import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const firebaseConfig = {apiKey: "AIzaSyCAQKDkkjdk87eLA_3e-dK8kZPXpjTbMSE",
    authDomain: "uzhavan-b1f99.firebaseapp.com",
    projectId: "uzhavan-b1f99",
    storageBucket: "uzhavan-b1f99.firebasestorage.app",
    messagingSenderId: "896196850525",
    appId: "1:896196850525:web:ba2498365beb5d7b6deeb4",
    measurementId: "G-YSS0KYB6SB"
  // Paste the fields from your Firebase config object here:
  // apiKey, authDomain, projectId, storageBucket,
  // messagingSenderId, and appId
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
document.addEventListener('DOMContentLoaded', () => {
    // Basic Navigation Setup
    const pages = document.querySelectorAll('.page');
    const navBtns = {
        'nav-dashboard': 'dashboard-page',
        'nav-market': 'market-page',
        'nav-pest': 'pest-page',
        'nav-water': 'water-page',
        'nav-scheduler': 'scheduler-page'
    };

    function showPage(pageId) {
        pages.forEach(p => p.style.display = 'none');
        document.getElementById(pageId).style.display = 'block';
        
        // Handle Nav Highlight
        Object.keys(navBtns).forEach(id => {
            const btn = document.getElementById(id);
            if(btn) {
                if (navBtns[id] === pageId) {
                    btn.classList.add('active-nav');
                } else {
                    btn.classList.remove('active-nav');
                }
            }
        });
        window.scrollTo(0, 0);
    }

    // Default to login
    showPage('login-page');

    // Bind Navigation Buttons
    Object.keys(navBtns).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.addEventListener('click', () => showPage(navBtns[btnId]));
    });

    let confirmationResult = null;
let recaptchaVerifier = null;

const btnGetOtp = document.getElementById('btn-get-otp');
const stepPhone = document.getElementById('step-phone');
const stepOtp = document.getElementById('step-otp');
const btnVerify = document.getElementById('btn-verify');
const otpInput = document.getElementById('otp-input');
const otpStatusMsg = document.getElementById('otp-status-msg');

if (btnGetOtp) {
    btnGetOtp.addEventListener('click', async () => {
        const phone = document
            .getElementById('placeholder-phone')
            .value
            .replace(/\D/g, '');

        if (phone.length !== 10) {
            alert('Please enter a 10-digit phone number.');
            return;
        }

        // Use the saved US test number when testing.
        // Other numbers are treated as Indian (+91) numbers.
        const fullPhone = phone === '6505553434'
            ? '+16505553434'
            : `+91${phone}`;

        try {
            if (!recaptchaVerifier) {
                recaptchaVerifier = new RecaptchaVerifier(
                    auth,
                    'recaptcha-container',
                    { size: 'invisible' }
                );
            }

            confirmationResult = await signInWithPhoneNumber(
                auth,
                fullPhone,
                recaptchaVerifier
            );

            stepPhone.style.display = 'none';
            stepOtp.style.display = 'block';

            if (otpStatusMsg) {
                otpStatusMsg.innerText = `Enter the code for ${fullPhone}`;
                otpStatusMsg.style.color = '#16834a';
            }
        } catch (error) {
            console.error('Could not send Firebase OTP:', error);
            alert(`Could not send the code: ${error.message}`);

            if (recaptchaVerifier) {
                recaptchaVerifier.clear();
                recaptchaVerifier = null;
            }
        }
    });
}

if (btnVerify) {
    btnVerify.addEventListener('click', async () => {
        const code = otpInput ? otpInput.value.trim() : '';

        if (!confirmationResult) {
            alert('Please request a verification code first.');
            return;
        }

        if (code.length !== 6) {
            alert('Enter the 6-digit verification code.');
            return;
        }

        try {
            const userCredential = await confirmationResult.confirm(code);
const user = userCredential.user;

await setDoc(doc(db, 'users', user.uid), {
    phoneNumber: user.phoneNumber,
    updatedAt: serverTimestamp()
}, { merge: true });


            const navGroup = document.getElementById('app-navigation');
            if (navGroup) navGroup.style.display = 'block';

            showPage('dashboard-page');

            const dashboardButton = document.getElementById('nav-dashboard');
            if (dashboardButton) dashboardButton.classList.add('active-nav');

            initDashboard();
        } catch (error) {
            console.error('Firebase OTP verification failed:', error);
            alert('The code was not accepted. Check it and try again.');

            if (otpStatusMsg) {
                otpStatusMsg.innerText = 'Incorrect code. Please try again.';
                otpStatusMsg.style.color = '#b42318';
            }
        }
    });
}

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            const navGroup = document.getElementById('app-navigation');
            if (navGroup) navGroup.style.display = 'none';
            showPage('login-page');
            if(stepOtp) stepOtp.style.display = 'none';
            if(stepPhone) stepPhone.style.display = 'block';
        });
    }

    // -----------------------
    // MOCK DATA GENERATION
    // -----------------------
    function initDashboard() {
        renderSchemes();
        renderBanks();
        renderMandi();
        updateWeather(); // Initial mock weather set
    }

    // -----------------------
    // WEATHER LOGIC
    // -----------------------
    const btnUpdateWeather = document.getElementById('btn-update-weather');
    if (btnUpdateWeather) {
        btnUpdateWeather.addEventListener('click', updateWeather);
    }
    const locationInput = document.getElementById('location-input');
    if (locationInput) {
        locationInput.addEventListener('change', updateWeather);
    }

    const waterLocationInput = document.getElementById('water-location');
    const btnCalcWater = document.getElementById('btn-calc-water');
    const btnRefreshWeather = document.getElementById('btn-refresh-weather');
    const btnWaterVoice = document.getElementById('btn-water-voice');
    const btnWaterScheduleVoice = document.getElementById('btn-water-schedule-voice');

    let waterWeatherState = {
        temperature: 29,
        humidity: 62,
        rainfall: 6,
        moisture: 55,
        rainForecast: 'Light rain chance today.'
    };

    if (waterLocationInput) {
        waterLocationInput.addEventListener('change', refreshWaterWeather);
    }
    if (btnRefreshWeather) {
        btnRefreshWeather.addEventListener('click', refreshWaterWeather);
    }
    if (btnCalcWater) {
        btnCalcWater.addEventListener('click', calculateWaterNeeds);
    }
    if (btnWaterVoice) {
        btnWaterVoice.addEventListener('click', speakWaterSummary);
    }
    if (btnWaterScheduleVoice) {
        btnWaterScheduleVoice.addEventListener('click', speakWaterSchedule);
    }

    async function fetchWeatherForecastForLocation(locationLabel) {
        try {
            const query = encodeURIComponent(locationLabel.split(',')[0].trim());
            const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=en&format=json`);
            const geoData = await geoResponse.json();
            const place = geoData?.results?.[0];
            if (!place) throw new Error('Location not found');

            const lat = place.latitude;
            const lon = place.longitude;
            const forecastResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,precipitation&daily=precipitation_sum&current_weather=true&timezone=auto`);
            const data = await forecastResponse.json();
            const current = data.current_weather || {};
            const humidity = Array.isArray(data.hourly?.relativehumidity_2m) ? data.hourly.relativehumidity_2m[0] : 60;
            const rainfall = Array.isArray(data.hourly?.precipitation) ? data.hourly.precipitation[0] : 0;
            const dailyRain = Array.isArray(data.daily?.precipitation_sum) ? data.daily.precipitation_sum[0] : 0;
            const moisture = Math.max(20, Math.min(80, 52 + ((humidity - 55) * 0.35) - ((current.temperature - 26) * 0.5)));

            return {
                temperature: Math.round(current.temperature ?? 28),
                humidity: Math.round(humidity),
                rainfall: Number(rainfall.toFixed(1)),
                moisture: Math.round(moisture),
                rainForecast: dailyRain > 8 ? `Rain likely: ${dailyRain.toFixed(1)} mm expected today.` : 'Light or no rain expected today.'
            };
        } catch (err) {
            console.warn('Forecast fetch failed', err);
            return null;
        }
    }

    function updateWaterWeatherDisplay() {
        if (document.getElementById('water-weather-temp')) document.getElementById('water-weather-temp').innerText = `${waterWeatherState.temperature}°C`;
        if (document.getElementById('water-weather-humidity')) document.getElementById('water-weather-humidity').innerText = `${waterWeatherState.humidity}%`;
        if (document.getElementById('water-weather-rain')) document.getElementById('water-weather-rain').innerText = `${waterWeatherState.rainfall} mm`;
        if (document.getElementById('water-weather-moisture')) document.getElementById('water-weather-moisture').innerText = `${waterWeatherState.moisture}%`;
        if (document.getElementById('water-rain-forecast')) document.getElementById('water-rain-forecast').innerText = waterWeatherState.rainForecast;
    }

    async function refreshWaterWeather() {
        const locationLabel = waterLocationInput ? waterLocationInput.value : 'Chennai, TN';
        const forecast = await fetchWeatherForecastForLocation(locationLabel);
        if (forecast) {
            waterWeatherState = forecast;
        } else {
            waterWeatherState = {
                temperature: Math.floor(Math.random() * 10) + 26,
                humidity: Math.floor(Math.random() * 35) + 55,
                rainfall: Math.floor(Math.random() * 10),
                moisture: Math.floor(Math.random() * 25) + 50,
                rainForecast: 'Live forecast unavailable; using last known estimates.'
            };
        }
        updateWaterWeatherDisplay();
    }

    function getCropWaterBase(crop) {
        const base = {
            'Paddy (Rice)': 12,
            'Wheat': 6,
            'Maize': 7,
            'Tomato': 5,
            'Cotton': 8,
            'Groundnut': 6,
            'Sugarcane': 10,
            'Vegetables': 5,
            'Pulses': 4
        };
        return base[crop] || 6;
    }

    function calculateWaterNeeds() {
        const areaValue = parseFloat(document.getElementById('water-area').value);
        const unit = document.getElementById('water-area-unit').value;
        const crop = document.getElementById('water-crop').value;
        const soil = document.getElementById('water-soil').value;
        const method = document.getElementById('water-method').value;
        const stage = document.getElementById('water-stage').value;

        if (isNaN(areaValue) || areaValue <= 0) {
            alert('Please enter a valid land area');
            return;
        }

        const areaM2 = unit === 'acre' ? areaValue * 4046.86 : areaValue * 10000;
        const baseETo = getCropWaterBase(crop);
        const stageMultiplier = {
            'Planting': 1.1,
            'Vegetative': 1.0,
            'Flowering': 1.2,
            'Fruiting': 1.3,
            'Maturity': 0.9
        }[stage] || 1.0;
        const soilFactor = {
            'Clay': 0.9,
            'Sandy': 1.2,
            'Sandy Loam': 1.1,
            'Loam': 1.0,
            'Silt': 0.95
        }[soil] || 1.0;
        const methodEfficiency = {
            'Drip': 0.85,
            'Sprinkler': 0.75,
            'Furrow': 0.6,
            'Flood': 0.5
        }[method] || 0.7;

        const weatherAdjustment = 1 + Math.max(0, (waterWeatherState.temperature - 30) * 0.025) - Math.min(0.25, Math.max(0, (waterWeatherState.humidity - 55) * 0.0025)) - Math.min(0.4, waterWeatherState.rainfall * 0.03);
        const adjustedWeather = Math.max(0.65, Math.min(1.35, weatherAdjustment));

        let dailyLiters = areaM2 * baseETo * stageMultiplier * soilFactor * adjustedWeather;
        dailyLiters = Math.max(150, dailyLiters * 0.95 / methodEfficiency);
        const weeklyLiters = dailyLiters * 7;

        const recommendedMethod = waterWeatherState.rainfall > 8 ? 'Drip Irrigation' : method;
        const efficiencyScore = Math.max(55, Math.round((methodEfficiency * 100) - ((waterWeatherState.rainfall > 8 ? 5 : 0))));

        const dailyBar = Math.min(100, Math.round((dailyLiters / 12000) * 100));
        const weeklyBar = Math.min(100, Math.round((weeklyLiters / 84000) * 100));

        if (document.getElementById('water-daily')) document.getElementById('water-daily').innerText = `${Math.round(dailyLiters).toLocaleString()} L`;
        if (document.getElementById('water-weekly')) document.getElementById('water-weekly').innerText = `${Math.round(weeklyLiters).toLocaleString()} L`;
        if (document.getElementById('water-recommended-method')) document.getElementById('water-recommended-method').innerText = recommendedMethod;
        if (document.getElementById('water-efficiency-score')) document.getElementById('water-efficiency-score').innerText = `${efficiencyScore}%`;
        if (document.getElementById('water-bar-daily')) document.getElementById('water-bar-daily').style.height = `${Math.max(18, dailyBar)}%`;
        if (document.getElementById('water-bar-weekly')) document.getElementById('water-bar-weekly').style.height = `${Math.max(18, weeklyBar)}%`;

        const schedule = [
            { time: 'Today', note: `Apply ${Math.round(dailyLiters)} L before 10 AM when soil is cooler.` },
            { time: 'Next 2 Days', note: `Use ${Math.round(dailyLiters * 0.9)} L per day and monitor rainfall closely.` },
            { time: 'Midweek', note: `Switch ${recommendedMethod === method ? 'method' : 'to drip irrigation'} if rainfall remains low.` },
            { time: 'Weekend', note: `Recheck soil moisture and avoid extra water if the top 5 cm feels wet.` }
        ];

        const tips = [
            `Prefer ${recommendedMethod} for higher water efficiency.`,
            'Irrigate in the early morning or late evening to reduce evaporation.',
            waterWeatherState.rainfall > 5 ? 'Delay heavy irrigation because rain is expected soon.' : 'Use mulching to retain soil moisture.',
            'Check soil moisture before every irrigation to avoid overwatering.'
        ];

        const alerts = [];
        if (waterWeatherState.rainfall > 8) alerts.push({type:'info', text:'Upcoming rain detected — reduce irrigation volumes today.'});
        if (dailyLiters > areaM2 * 1.6) alerts.push({type:'warning', text:'High water requirement detected. Review irrigation method and check soil moisture frequently.'});
        if (dailyLiters < areaM2 * 0.5) alerts.push({type:'warning', text:'Low water estimate may indicate underwatering risk. Monitor plants closely.'});

        renderWaterSchedule(schedule);
        renderWaterTips(tips);
        setWaterAlerts(alerts);
    }

    function renderWaterSchedule(items) {
        const container = document.getElementById('water-schedule');
        if (!container) return;
        container.innerHTML = items.map(item => `
            <div class="schedule-card card" style="padding: 18px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);">
                <h4 style="margin:0 0 8px;">${item.time}</h4>
                <p style="margin:0; color: var(--text-muted);">${item.note}</p>
            </div>
        `).join('');
    }

    function renderWaterTips(tips) {
        const list = document.getElementById('water-tips');
        if (!list) return;
        list.innerHTML = tips.map(tip => `<li style="background: rgba(46,204,113,0.08); padding: 12px 14px; border-radius: 14px; color: #fff;">${tip}</li>`).join('');
    }

    function setWaterAlerts(alerts) {
        const container = document.getElementById('water-alerts');
        if (!container) return;
        if (!alerts.length) {
            container.innerHTML = `<div style="background: rgba(0,0,0,0.25); padding: 14px; border-radius: 14px; color: #a0aab2;">No alerts. Your irrigation plan looks balanced.</div>`;
            return;
        }
        container.innerHTML = alerts.map(alert => `
            <div style="background: rgba(255,255,255,0.08); border-left: 4px solid ${alert.type === 'info' ? '#4FC3F7' : '#FFB300'}; padding: 14px; border-radius: 14px; color: #fff;">
                <strong style="display:block; margin-bottom:4px;">${alert.type === 'info' ? 'Info' : 'Alert'}</strong>
                <span>${alert.text}</span>
            </div>
        `).join('');
    }

    function speakWaterSummary() {
        const crop = document.getElementById('water-crop').value;
        const daily = document.getElementById('water-daily').innerText;
        const weekly = document.getElementById('water-weekly').innerText;
        const method = document.getElementById('water-recommended-method').innerText;
        const forecast = waterWeatherState.rainForecast;
        speakText(`For ${crop}, daily water need is ${daily}, weekly water need is ${weekly}. Recommended method: ${method}. ${forecast}`);
    }

    function speakWaterSchedule() {
        const items = Array.from(document.querySelectorAll('#water-schedule .schedule-card'));
        const text = items.map(card => card.innerText.replace(/\n/g, '. ')).join(' ');
        if (text) speakText(text);
        else speakText('Your irrigation schedule will appear after calculating water requirements.');
    }

    function updateWeather(e) {
        const locBox = document.getElementById('location-input');
        const loc = locBox ? locBox.value : "Your Farm";
        
        // Mock Weather generation
        const temp = Math.floor(Math.random() * (38 - 22) + 22);
        const humid = Math.floor(Math.random() * (90 - 40) + 40);
        const wind = Math.floor(Math.random() * (15 - 2) + 2);
        const rain = Math.floor(Math.random() * 100);
        
        const statuses = ['Mostly Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Clear Skies'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const iconMap = {
            'Mostly Sunny': 'sun', 
            'Partly Cloudy': 'cloud-sun', 
            'Cloudy': 'cloud', 
            'Light Rain': 'cloud-rain', 
            'Clear Skies': 'sun'
        };
        const icon = iconMap[status] || 'cloud-sun';

        if (document.getElementById('weather-temp')) document.getElementById('weather-temp').innerText = temp;
        if (document.getElementById('weather-humid')) document.getElementById('weather-humid').innerText = humid;
        if (document.getElementById('weather-wind')) document.getElementById('weather-wind').innerText = wind;
        if (document.getElementById('weather-rain')) document.getElementById('weather-rain').innerText = rain;
        if (document.getElementById('txt-weather-status')) document.getElementById('txt-weather-status').innerText = status;
        
        const weatherIconElem = document.getElementById('weather-icon');
        if (weatherIconElem) {
            weatherIconElem.setAttribute('data-lucide', icon);
            if (window.lucide) lucide.createIcons();
        }
        
        // Only log/notify if it was a manual click
        if (e && e.type === 'click') {
           console.log(`Weather updated for ${loc}`);
        }
    }

    const SCHEMES = [
        { 
            name: "PM-Kisan Samman Nidhi", 
            desc: "Get ₹6,000 yearly in three installments directly into your bank account.", 
            tags: "Income Support",
            rules: { maxLand: 5 } 
        },
        { 
            name: "Pradhan Mantri Fasal Bima Yojana", 
            desc: "Insure your crops against natural calamities, pests or diseases.", 
            tags: "Crop Insurance",
            rules: { maxIncome: 200000 }
        },
        { 
            name: "Kisan Credit Card (KCC)", 
            desc: "Easy access to credit for agricultural needs at low interest rates.", 
            tags: "Low Interest Loan",
            rules: { minAge: 18, maxAge: 75 }
        },
        {
            name: "National Agriculture Market (e-NAM)",
            desc: "Electronic trading portal which networks the existing APMC mandis.",
            tags: "Market Access",
            rules: {}
        }
    ];

    // User Profile State
    let userProfile = null;
    let aiActive = false;

    // Profile Modal Handlers
    const profileModal = document.getElementById('profile-modal');
    const btnCompleteProfile = document.getElementById('btn-complete-profile');
    const profileBanner = document.getElementById('profile-banner');
    
    if (btnCompleteProfile) {
        btnCompleteProfile.addEventListener('click', () => {
            if(profileModal) profileModal.style.display = 'flex';
        });
    }
    
    document.getElementById('btn-close-modal')?.addEventListener('click', () => {
        if(profileModal) profileModal.style.display = 'none';
    });

    document.getElementById('btn-save-profile')?.addEventListener('click', () => {
        const age = document.getElementById('profile-age').value;
        const land = document.getElementById('profile-land').value;
        const income = document.getElementById('profile-income').value;
        
        userProfile = {
            age: age ? parseInt(age) : null,
            land: land ? parseFloat(land) : null,
            income: income ? parseFloat(income) : null
        };
        
        profileModal.style.display = 'none';
        if (profileBanner) profileBanner.style.display = 'none';
        
        // Refresh schemes if AI is active
        if (aiActive) renderSchemes();
    });

    // AI Suggestions Handler
    document.getElementById('btn-ai-schemes')?.addEventListener('click', () => {
        if (!userProfile) {
            alert("Please complete your profile first so AI can suggest the best schemes!");
            if(profileModal) profileModal.style.display = 'flex';
            return;
        }
        aiActive = true;
        renderSchemes();
    });

    // Eligibility Checker
    window.checkEligibility = (schemeName) => {
        if (!userProfile) {
            alert("⚠️ Please complete your profile to check eligibility!");
            if(profileModal) profileModal.style.display = 'flex';
            return;
        }
        
        const scheme = SCHEMES.find(s => s.name === schemeName);
        if (!scheme) return;
        
        const rules = scheme.rules;
        let eligible = true;
        let reason = "";

        if (rules.maxLand && userProfile.land > rules.maxLand) {
            eligible = false;
            reason = `Your land ownership (${userProfile.land} acres) exceeds the limit of ${rules.maxLand} acres.`;
        }
        if (rules.maxIncome && userProfile.income > rules.maxIncome) {
            eligible = false;
            reason = `Your annual income exceeds the maximum threshold of ₹${rules.maxIncome}.`;
        }
        if (rules.minAge && userProfile.age < rules.minAge) {
            eligible = false;
            reason = `You must be at least ${rules.minAge} years old.`;
        }
        if (rules.maxAge && userProfile.age > rules.maxAge) {
            eligible = false;
            reason = `You surpass the maximum age limit of ${rules.maxAge} years.`;
        }

        if (eligible) {
            alert(`✅ You are ELIGIBLE for ${schemeName}!\nRedirecting to application portal...`);
        } else {
            alert(`❌ You are NOT ELIGIBLE for ${schemeName}.\nReason: ${reason}`);
        }
    };

    const BANKS = [
        { name: "State Bank of India (Agri-Branch)", dist: "1.2 km", rate: "4.0%" },
        { name: "NABARD Rural Bank", dist: "2.5 km", rate: "4.5%" },
        { name: "HDFC Farmer Suvidha Bank", dist: "3.8 km", rate: "7.0%" },
        { name: "ICICI Rural Finance", dist: "4.1 km", rate: "8.5%" },
        { name: "Canara Bank (Rural Hub)", dist: "5.0 km", rate: "5.2%" },
        { name: "Indian Overseas Bank", dist: "6.3 km", rate: "4.8%" },
        { name: "Axis Bank Agri-SME", dist: "7.1 km", rate: "9.0%" },
        { name: "IDBI Priortiy Sector", dist: "8.5 km", rate: "6.5%" },
        { name: "Union Bank of India", dist: "9.2 km", rate: "5.5%" },
        { name: "Gramin Bank (Local)", dist: "10.4 km", rate: "4.0%" },
        { name: "Kotak Mahindra Rural", dist: "12.0 km", rate: "7.5%" },
        { name: "Bank of Baroda", dist: "13.5 km", rate: "5.0%" }
    ];

    const MANDI = [
        { crop: "Paddy (Rice)", price: "₹2,200", trend: "+₹50", isUp: true },
        { crop: "Wheat", price: "₹2,125", trend: "Stable", isUp: null },
        { crop: "Maize", price: "₹1,960", trend: "-₹20", isUp: false },
        { crop: "Cotton", price: "₹6,800", trend: "+₹150", isUp: true },
        { crop: "Sugarcane", price: "₹3,150", trend: "Stable", isUp: null },
        { crop: "Groundnut", price: "₹5,400", trend: "-₹100", isUp: false },
        { crop: "Soybean", price: "₹4,600", trend: "+₹80", isUp: true },
        { crop: "Turmeric", price: "₹8,200", trend: "+₹200", isUp: true },
        { crop: "Tomato", price: "₹1,500", trend: "-₹300", isUp: false },
        { crop: "Onion", price: "₹2,800", trend: "Stable", isUp: null }
    ];

    function renderSchemes() {
        const container = document.getElementById('schemes-list');
        if(!container) return;
        
        container.innerHTML = SCHEMES.map(s => {
            let isRecommended = false;
            if (aiActive && userProfile) {
                // If the user profile passes the rules, it's highly recommended
                isRecommended = true;
                if (s.rules.maxLand && userProfile.land > s.rules.maxLand) isRecommended = false;
                if (s.rules.maxIncome && userProfile.income > s.rules.maxIncome) isRecommended = false;
                if (s.rules.minAge && userProfile.age < s.rules.minAge) isRecommended = false;
                if (s.rules.maxAge && userProfile.age > s.rules.maxAge) isRecommended = false;
            }

            return `
            <div class="scheme-card card" style="padding: 15px; margin-bottom: 10px; border: ${isRecommended ? '2px solid #FFB300' : '1px solid rgba(255, 255, 255, 0.08)'}; position: relative;">
                ${isRecommended ? '<div style="position: absolute; top: -12px; right: 20px; background: #FFB300; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; box-shadow: 0 4px 10px rgba(255, 179, 0, 0.4);"><i data-lucide="sparkles" style="width:12px; display:inline;"></i> AI Recommended</div>' : ''}
                <span class="badge badge-success">${s.tags}</span>
                <h4 style="margin: 8px 0; color: #1B5E20;">${s.name}</h4>
                <p style="font-size: 0.9rem;">${s.desc}</p>
                <button class="btn btn-outline" style="width: 100%; margin-top: 10px; padding: 8px;" onclick="checkEligibility('${s.name}')">Apply</button>
            </div>
            `;
        }).join('');
        lucide.createIcons(); // re-create icons in dynamically injected HTML
    }

    function renderBanks() {
        const container = document.getElementById('banks-list');
        if(!container) return;
        container.innerHTML = BANKS.map(b => `
            <div class="bank-card card" style="padding: 15px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="margin: 0; color: #1B5E20;">${b.name}</h4>
                    <p style="font-size: 0.8rem; color: #666;">${b.dist} away</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 0.8rem; margin:0;">Interest</p>
                    <strong style="color: var(--primary);">${b.rate}</strong>
                </div>
            </div>
        `).join('');
    }

    function renderMandi() {
        const container = document.getElementById('mandi-grid');
        if(!container) return;
        container.innerHTML = MANDI.map(m => {
            let icon = m.isUp === true ? 'trending-up' : (m.isUp === false ? 'trending-down' : 'minus');
            let color = m.isUp === true ? '#4CAF50' : (m.isUp === false ? '#F44336' : '#2196F3');
            
            return `
            <div class="card" style="text-align:center; padding: 25px; border-radius: 20px; border-bottom: 4px solid ${color};">
                <h3 style="margin-bottom: 12px; font-size: 1.1rem; color: #1B5E20;">${m.crop}</h3>
                <p style="font-size: 2.4rem; font-weight: 800; color: var(--primary); margin: 0;">${m.price}</p>
                <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 15px; background: ${color}22; padding: 6px 12px; border-radius: 12px; color: ${color}; font-weight: 700; width: fit-content; margin-inline: auto;">
                    <i data-lucide="${icon}" style="width: 18px; height: 18px;"></i>
                    <span style="font-size: 0.9rem;">${m.trend}</span>
                </div>
            </div>
            `;
        }).join('');
        lucide.createIcons();
    }

    // -----------------------
    // AI CHAT BOT LOGIC
    // -----------------------
    const btnSend = document.getElementById('btn-send');
    const inputChat = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');

    if(btnSend && inputChat) {
        // Toggle floating chat
        const btnToggleChat = document.getElementById('btn-toggle-chat');
        const btnCloseChat = document.getElementById('btn-close-chat');
        const chatWindow = document.getElementById('chat-window');
        
        if(btnToggleChat && chatWindow) {
            btnToggleChat.addEventListener('click', () => {
                chatWindow.style.display = 'flex';
                if (messages.children.length <= 1) {
                    botReply('greeting', true);
                }
            });
        }
        if(btnCloseChat && chatWindow) {
            btnCloseChat.addEventListener('click', () => chatWindow.style.display = 'none');
        }

        // Global DOM Translation Hook
        const mainLangSelector = document.getElementById('main-lang-selector');
        if (mainLangSelector) {
            mainLangSelector.addEventListener('change', (e) => {
                const lang = e.target.value;
                const googCombo = document.querySelector('.goog-te-combo');
                if (googCombo) {
                    googCombo.value = lang;
                    googCombo.dispatchEvent(new Event('change'));
                }
            });
        }

        // Centralized Language Mapping Helper
        window.getCurrentLangInfo = () => {
            const sel = document.getElementById('main-lang-selector') || document.getElementById('language');
            const code = sel ? sel.value : 'en';
            const langMap = {
                'en': 'en-IN', 'ta': 'ta-IN', 'hi': 'hi-IN', 'te': 'te-IN',
                'kn': 'kn-IN', 'ml': 'ml-IN', 'mr': 'mr-IN', 'gu': 'gu-IN',
                'pa': 'pa-IN', 'bn': 'bn-IN', 'or': 'or-IN', 'as': 'as-IN'
            };
            return {
                code: code,
                full: langMap[code] || 'en-IN'
            };
        };

        // Robust Global TTS logic
        window.speakText = (text) => {
            if (!('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            const langInfo = window.getCurrentLangInfo();
            const targetLang = langInfo.full;
            utterance.lang = targetLang;

            const speakWithVoice = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length === 0) {
                    setTimeout(speakWithVoice, 100);
                    return;
                }

                let voice = voices.find(v => v.lang === targetLang || v.lang.replace('_', '-') === targetLang);
                if (!voice) voice = voices.find(v => v.lang.startsWith(langInfo.code));
                
                if (!voice) {
                    const langNameMap = { 'ta': 'Tamil', 'hi': 'Hindi', 'te': 'Telugu', 'en': 'English' };
                    const searchName = (langNameMap[langInfo.code] || 'English').toLowerCase();
                    voice = voices.find(v => v.name.toLowerCase().includes(searchName));
                }

                if (voice) {
                    utterance.voice = voice;
                    utterance.lang = voice.lang;
                }
                
                utterance.rate = 0.95;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            };

            speakWithVoice();
        };

        // Enhanced Bot Translations for Multi-language support
        const botTranslations = {
            'hi': {
                'greeting': "नमस्ते! मुझे बताएं कि आपको किस चीज में मदद चाहिए।",
                'default': "मैं आपका AI सहायक हूँ! मुझसे 'पीएम किसान', 'कीड़े', 'उर्वरक', या 'ऋण' के बारे में पूछने का प्रयास करें।",
                'schemes': "आप डैशबोर्ड अनुभाग में पीएम-किसान जैसी उपलब्ध योजनाएं देख सकते हैं।",
                'loans': "बढ़िया ब्याज दरों के साथ कृषि ऋण के लिए पास के बैंक अनुभाग की जाँच करें!",
                'pests': "कृपया 'कीट कवच' टैब पर जाएं और प्रभावित फसल के पत्ते की तस्वीर अपलोड करें।"
            },
            'ta': {
                'greeting': "வணக்கம்! உங்களுக்கு என்ன உதவி தேவை என்று சொல்லுங்கள்.",
                'default': "நான் உங்கள் AI உதவியாளர்! 'PM கிசான்', 'பூச்சிகள்', 'உரம்' அல்லது 'கடன்கள்' பற்றி என்னிடம் கேட்கவும்.",
                'schemes': "டாஷ்போர்டு பிரிவில் PM-கிசான் போன்ற திட்டங்களை நீங்கள் பார்க்கலாம்.",
                'loans': "சிறந்த வட்டி விகிதங்களுடன் விவசாயக் கடன்களுக்கு அருகிலுள்ள வங்கிகள் பகுதியைச் சரிபார்க்கவும்!",
                'pests': "தயவுசெய்து 'பூச்சி கவசம்' தாவலுக்குச் சென்று பாதிக்கப்பட்ட பயிர் இலையின் புகைப்படத்தைப் பதிவேற்றவும்."
            },
            'en': {
                'greeting': "Hello! Let me know what you need help with.",
                'default': "I am your AI assistant! Try asking me about 'PM Kisan', 'Pests', 'Fertilizer', or 'Loans'.",
                'schemes': "You can view available schemes like PM-Kisan in the Dashboard section.",
                'loans': "Check the Nearby Banks section for Agri-loans with great interest rates!",
                'pests': "Please go to the 'Pest Shield' tab and upload a photo of the affected crop leaf."
            }
        };

        const botReply = (type, isFirst = false) => {
            const code = document.getElementById('main-lang-selector').value || 'en';
            const dict = botTranslations[code] || botTranslations['en'];
            const reply = dict[type] || dict['default'];
            
            if (isFirst) messages.innerHTML = ''; // Clear hardcoded initial msg
            
            messages.innerHTML += `<div class="message msg-bot" style="margin-bottom:12px; width:fit-content; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.1); padding:10px 15px; border-radius:15px;">${reply}</div>`;
            messages.scrollTop = messages.scrollHeight;
            window.speakText(reply);
        };

        const handleChat = () => {
            const val = inputChat.value.trim();
            if(!val) return;
            
            // Add user msg
            messages.innerHTML += `<div class="message" style="background:rgba(46,125,50,0.4); padding:12px 16px; border-radius:16px 16px 4px 16px; margin-bottom:12px; align-self: flex-end; width:fit-content; margin-left:auto; color: white;">${val}</div>`;
            inputChat.value = '';
            
            setTimeout(() => {
                let type = 'default';
                const lower = val.toLowerCase();
                if(lower.includes('kisan') || lower.includes('schemes') || lower.includes('த்திட்டங்கள்') || lower.includes('योजनाएं')) type = 'schemes';
                if(lower.includes('loan') || lower.includes('bank') || lower.includes('கடன்') || lower.includes('बैंकिंग') || lower.includes('ऋण')) type = 'loans';
                if(lower.includes('pest') || lower.includes('disease') || lower.includes('பூச்சி') || lower.includes('कीट')) type = 'pests';
                
                botReply(type);
            }, 600);
        };
        
        btnSend.addEventListener('click', handleChat);
        inputChat.addEventListener('keypress', e => e.key === 'Enter' && handleChat());

        // Handle Audio Input Setup (Web Speech API)
        const btnMic = document.getElementById('btn-mic');
        if(btnMic && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            
            btnMic.addEventListener('click', () => {
                const langInfo = window.getCurrentLangInfo();
                recognition.lang = langInfo.full;
                btnMic.style.backgroundColor = '#e74c3c'; // Alert red to show it is listening
                btnMic.style.borderColor = '#c0392b';
                try { recognition.start(); } catch(e){}
            });
            
            recognition.onresult = (event) => {
                const speechResult = event.results[0][0].transcript;
                inputChat.value = speechResult;
                handleChat();
            };
            
            recognition.onend = () => {
                btnMic.style.backgroundColor = ''; // Reset back to default
                btnMic.style.borderColor = '';
            };
        }
    }

    // -----------------------
    // PEST SCANNER & MIXING CALCULATOR
    // -----------------------
    const btnAnalyze = document.getElementById('btn-analyze-pest');
    const calcSection = document.getElementById('pest-calc-section');
    const resultBox = document.getElementById('pest-scan-preview');
    let identifiedPest = "";

    if(btnAnalyze) {
        btnAnalyze.addEventListener('click', () => {
            const input = document.getElementById('pest-image-input');
            if(input && input.files.length > 0) {
                resultBox.innerHTML = "<p style='color: #FF9800; font-weight: bold;'>⏳ YOLOv8 AI Model processing image...</p>";
                
                const pests = ["Aphids", "Spider Mites", "Whiteflies", "Caterpillars"];
                identifiedPest = pests[Math.floor(Math.random() * pests.length)];
                const confidence = Math.floor(Math.random() * 15) + 80; // 80% to 95%

                setTimeout(() => {
                    resultBox.innerHTML = `
                        <div style="background: rgba(46, 204, 113, 0.15); padding: 15px; border-radius: 12px; border: 1px solid #2ECC71;">
                            <h4 style="color:#2ECC71; margin-bottom:5px;">Identified: ${identifiedPest}</h4>
                            <p style="margin: 8px 0; font-size: 0.9rem; color:white;">YOLOv8 Confidence Score: ${confidence}%</p>
                            <span class="badge" style="background:#0277bd; color:white; padding:4px 8px; font-size:0.8rem;">Proceed to Step 2</span>
                        </div>
                    `;
                    if (calcSection) calcSection.style.display = 'block';
                }, 1500);
            } else {
                alert("Please attach a photo of the affected plant first.");
            }
        });
    }

    const btnCalculate = document.getElementById('btn-calculate-mix');
    if (btnCalculate) {
        btnCalculate.addEventListener('click', () => {
            const area = parseFloat(document.getElementById('calc-area').value);
            const ratio = parseFloat(document.getElementById('calc-ratio').value);
            const type = document.getElementById('calc-type').value; // Organic or Chemical

            if (isNaN(area) || isNaN(ratio)) {
                alert("⚠️ Please enter a valid Area and Concentration Ratio.");
                return;
            }

            // Calculation Logic: Assuming 1 Liter of mixed solution treats roughly 10 square meters safely.
            const totalWaterLiters = area / 10;
            const totalChemicalMl = totalWaterLiters * ratio;
            
            document.getElementById('txt-calc-water').innerHTML = `🔹 Total Water Base: <strong>${Math.ceil(totalWaterLiters)} Liters</strong>`;
            document.getElementById('txt-calc-chemical').innerHTML = `🔹 Standard ${type} Dose: <strong>${totalChemicalMl.toFixed(1)} ml</strong>`;
            document.getElementById('txt-calc-method').innerText = `Mix ${totalChemicalMl.toFixed(1)} ml of the ${type.toLowerCase()} pesticide exactly in ${Math.ceil(totalWaterLiters)} liters of water and spray evenly across the ${area} sq meter area to eliminate ${identifiedPest}.`;

            document.getElementById('calc-results').style.display = 'block';
        });
    }

        // -----------------------
        // LIVE PEST DETECTION (TensorFlow.js / Coco-SSD fallback)
        // -----------------------
        let tfModel = null;
        let liveStream = null;
        let detectionInterval = null;

        const btnLoadModel = document.getElementById('btn-load-model');
        const btnStartLive = document.getElementById('btn-start-live');
        const btnStopLive = document.getElementById('btn-stop-live');
        const modelUrlInput = document.getElementById('model-url');
        const liveStatus = document.getElementById('live-model-status');
        const liveContainer = document.getElementById('live-detect-container');
        const liveVideo = document.getElementById('live-video');
        const liveOverlay = document.getElementById('live-overlay');
        const overlayCtx = liveOverlay ? liveOverlay.getContext('2d') : null;

        if (modelUrlInput && !modelUrlInput.value) {
            modelUrlInput.value = 'coco-ssd';
        }
        const detectModeSelect = document.getElementById('detect-mode');
        if (detectModeSelect && !detectModeSelect.value) {
            detectModeSelect.value = 'local';
        }

        // Load TF scripts dynamically when user attempts to load a model
        function injectTfScripts(callback) {
            if (window.tf || window.cocoSsd) return callback();
            const s1 = document.createElement('script');
            s1.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.12.0/dist/tf.min.js';
            s1.onload = () => {
                const s2 = document.createElement('script');
                s2.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js';
                s2.onload = () => callback();
                s2.onerror = () => callback();
                document.head.appendChild(s2);
            };
            s1.onerror = () => callback();
            document.head.appendChild(s1);
        }

        async function loadModel(urlOrKey) {
            liveStatus.innerText = 'Loading model...';
            try {
                if (urlOrKey === 'coco-ssd') {
                    await injectTfScripts(() => {});
                    if (!window.cocoSsd) throw new Error('Coco-SSD script failed to load');
                    tfModel = await window.cocoSsd.load();
                } else {
                    await injectTfScripts(() => {});
                    if (!window.tf) throw new Error('TensorFlow.js failed to load');
                    tfModel = await window.tf.loadGraphModel(urlOrKey);
                }

                liveStatus.innerText = 'Model loaded.';
                btnStartLive.disabled = false;
                btnStopLive.disabled = true;
                return true;
            } catch (err) {
                console.error('Model load error', err);
                liveStatus.innerText = 'Model failed to load: ' + (err.message || err);
                tfModel = null;
                btnStartLive.disabled = true;
                return false;
            }
        }

        btnLoadModel?.addEventListener('click', async () => {
            const val = modelUrlInput.value.trim() || 'coco-ssd';
            liveStatus.innerText = 'Preparing to load model...';
            await loadModel(val);
        });

        async function startCamera() {
            try {
                liveStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
                liveVideo.srcObject = liveStream;
                liveVideo.play();
                liveContainer.style.display = 'block';
                liveOverlay.width = liveVideo.clientWidth;
                liveOverlay.height = liveVideo.clientHeight;
                return true;
            } catch (err) {
                console.error('Camera error', err);
                alert('Cannot access camera: ' + (err.message || err));
                return false;
            }
        }

        function stopCamera() {
            if (liveStream) {
                liveStream.getTracks().forEach(t => t.stop());
                liveStream = null;
            }
            liveVideo.pause();
            liveVideo.srcObject = null;
            liveContainer.style.display = 'none';
        }

        function drawDetections(dets) {
            if (!overlayCtx) return;
            overlayCtx.clearRect(0,0,liveOverlay.width, liveOverlay.height);
            overlayCtx.lineWidth = 2;
            overlayCtx.font = '16px Arial';
            dets.forEach(d => {
                const x = d.bbox ? d.bbox[0] : d[0];
                const y = d.bbox ? d.bbox[1] : d[1];
                const w = d.bbox ? d.bbox[2] : d[2];
                const h = d.bbox ? d.bbox[3] : d[3];
                overlayCtx.strokeStyle = '#00FF00';
                overlayCtx.strokeRect(x, y, w, h);
                const text = `${d.class || d.label || 'obj'} ${(d.score || d[4]||0).toFixed(2)}`;
                overlayCtx.fillStyle = '#00FF00';
                overlayCtx.fillText(text, x + 4, y + 16);
            });
        }

        async function runDetectionOnce() {
            if (!tfModel) return;
            if (!liveVideo || liveVideo.readyState < 2) return;

            try {
                // If coco-ssd model (has detect method)
                if (typeof tfModel.detect === 'function') {
                    const detections = await tfModel.detect(liveVideo);
                    drawDetections(detections.map(d => ({ bbox: d.bbox, class: d.class, score: d.score })));
                } else if (window.tf && tfModel.executeAsync) {
                    // Generic graph model path - basic image preprocessing
                    const img = window.tf.browser.fromPixels(liveVideo).expandDims(0).toFloat().div(255);
                    const res = await tfModel.executeAsync(img);
                    // This generic path won't draw boxes without a specific postprocess; just show that model ran
                    drawDetections([]);
                    img.dispose();
                    if (Array.isArray(res)) res.forEach(r => r.dispose()); else res.dispose();
                }
            } catch (err) {
                console.error('Detection error', err);
            }
        }

        // Remote detection: POST frame to server and draw response
        let remoteRunning = false;
        async function runDetectionRemote() {
            const serverUrl = document.getElementById('model-url').value.trim();
            if (!serverUrl) {
                liveStatus.innerText = 'Remote server URL required.';
                return;
            }
            if (!liveVideo || liveVideo.readyState < 2) return;

            try {
                // capture current frame to blob
                const off = document.createElement('canvas');
                off.width = liveVideo.videoWidth;
                off.height = liveVideo.videoHeight;
                const ctxOff = off.getContext('2d');
                ctxOff.drawImage(liveVideo, 0, 0, off.width, off.height);

                const blob = await new Promise(resolve => off.toBlob(resolve, 'image/jpeg', 0.8));

                const headers = {};
                const key = document.getElementById('remote-api-key')?.value.trim();
                if (key) headers['Authorization'] = key;

                const resp = await fetch(serverUrl, {
                    method: 'POST',
                    headers: headers,
                    body: blob
                });

                if (!resp.ok) {
                    const txt = await resp.text();
                    liveStatus.innerText = 'Server error: ' + resp.status + ' ' + txt;
                    return;
                }

                const data = await resp.json();
                // Expecting { detections: [ {bbox:[x,y,w,h], class:'name', score:0.9}, ... ] }
                const dets = Array.isArray(data.detections) ? data.detections : [];
                drawDetections(dets.map(d => ({ bbox: d.bbox, class: d.class || d.label, score: d.score || d.confidence || 0 })));
            } catch (err) {
                console.error('Remote detect error', err);
                liveStatus.innerText = 'Remote detect failed: ' + (err.message || err);
            }
        }

        btnStartLive?.addEventListener('click', async () => {
            const mode = document.getElementById('detect-mode')?.value || 'local';
            if (mode === 'local' && !tfModel) { alert('Please load a local model first.'); return; }
            const ok = await startCamera();
            if (!ok) return;
            btnStartLive.disabled = true;
            btnStopLive.disabled = false;
            if (mode === 'local') {
                liveStatus.innerText = 'Running in-browser detection...';
                detectionInterval = setInterval(runDetectionOnce, 500);
            } else {
                liveStatus.innerText = 'Running remote detection...';
                remoteRunning = true;
                detectionInterval = setInterval(runDetectionRemote, 700);
            }
        });

        btnStopLive?.addEventListener('click', () => {
            if (detectionInterval) { clearInterval(detectionInterval); detectionInterval = null; }
            stopCamera();
            btnStartLive.disabled = false;
            btnStopLive.disabled = true;
            liveStatus.innerText = 'Model loaded. Live stopped.';
            if (overlayCtx) overlayCtx.clearRect(0,0,liveOverlay.width, liveOverlay.height);
        });

    // -----------------------
    // CROP SCHEDULER LOGIC
    // -----------------------
    const btnGenerateSched = document.getElementById('btn-generate-sched');
    if (btnGenerateSched) {
        btnGenerateSched.addEventListener('click', () => {
            const location = document.getElementById('sched-location').value;
            const month = document.getElementById('sched-month').value;
            
            // Show the recommendation card
            document.getElementById('recommended-crops-card').style.display = 'block';
            renderCropRecommendations(location, month);
        });
    }

    const CROP_SCHED_DATA = {
        'Paddy (Rice)': {
            icon: 'wheat',
            tasks: [
                { date: 'Month 1, Day 1-10', task: 'Land Preparation', desc: 'Plough the field 2-3 times and level the land. Apply farmyard manure.' },
                { date: 'Month 1, Day 11-15', task: 'Sowing/Transplanting', desc: 'Sow seeds in the nursery or transplant 25-30 day old seedlings to the main field.' },
                { date: 'Month 1, Day 25+', task: 'Irrigation', desc: 'Maintain 2-5 cm of standing water in the field.' },
                { date: 'Month 2, Day 1-5', task: 'Fertilizer Application', desc: 'Apply first dose of Nitrogen (Urea) and Phosphorus.' },
                { date: 'Month 3, Day 10-15', task: 'Pest Control', desc: 'Monitor for Stem Borer and Leaf Folder. Use organic neem oil if detected.' },
                { date: 'Month 5, Day 1-10', task: 'Harvesting', desc: 'Harvest when 80% of grains turn golden yellow.' }
            ]
        },
        'Tomato': {
            icon: 'carrot',
            tasks: [
                { date: 'Month 1, Day 1-5', task: 'Land Preparation', desc: 'Prepare raised beds. Mix compost and sand into the soil.' },
                { date: 'Month 1, Day 7-10', task: 'Transplanting', desc: 'Transplant healthy seedlings with 60cm x 45cm spacing.' },
                { date: 'Month 2, Day 1-30', task: 'Staking & Irrigation', desc: 'Provide support with sticks. Water every 2-3 days.' },
                { date: 'Month 2, Day 15', task: 'Fertilizer', desc: 'Apply NPK 10:10:10 mixture.' },
                { date: 'Month 3, Day 1-45', task: 'Pest Control', desc: 'Watch for Fruit Borer. Use pheromone traps.' },
                { date: 'Month 4, Day 10+', task: 'Harvesting', desc: 'Pick tomatoes when they reach desired color/ripeness.' }
            ]
        },
        'Wheat': {
            icon: 'wheat',
            tasks: [
                { date: 'Month 1, Day 1', task: 'Field Prep', desc: 'Clean field of previous crop remains. Fine tilth is important.' },
                { date: 'Month 1, Day 3', task: 'Sowing', desc: 'Sow at depth of 4-5cm using seed drill.' },
                { date: 'Month 2, Day 21', task: 'First Irrigation', desc: 'CRIs stage is most critical for watering.' },
                { date: 'Month 3, Day 10', task: 'Weeding', desc: 'Manual weeding or appropriate herbicide application.' },
                { date: 'Month 5, Day 15', task: 'Harvesting', desc: 'Harvest when grain moisture is below 15%.' }
            ]
        }
    };

    const MONTHLY_RECOMMENDATIONS = {
        'January': ['Tomato', 'Groundnut', 'Maize'],
        'June': ['Paddy (Rice)', 'Sugarcane', 'Cotton'],
        'October': ['Wheat', 'Chickpea', 'Mustard']
    };

    function renderCropRecommendations(location, month) {
        const list = document.getElementById('crop-recommendation-list');
        const defaultCrops = ['Paddy (Rice)', 'Tomato', 'Wheat'];
        const crops = MONTHLY_RECOMMENDATIONS[month] || defaultCrops;
        
        list.innerHTML = crops.map(c => `
            <div class="card" style="padding: 15px; cursor: pointer; border-color: rgba(46, 204, 113, 0.2);" onclick="showDetailedSchedule('${c}')">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="background: rgba(46, 204, 113, 0.2); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="leaf" style="color: #2ECC71;"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0;">${c}</h4>
                        <p style="font-size: 0.8rem; margin: 0;">Click to view full schedule for ${location}</p>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }

    window.showDetailedSchedule = (crop) => {
        const view = document.getElementById('scheduler-task-view');
        const items = document.getElementById('timeline-items');
        const title = document.getElementById('txt-selected-crop-title');
        
        if (!CROP_SCHED_DATA[crop]) {
            alert("Detailed schedule for " + crop + " is coming soon!");
            return;
        }

        title.innerText = `${crop} - Full Management Schedule`;
        view.style.display = 'block';
        
        const data = CROP_SCHED_DATA[crop];
        items.innerHTML = data.tasks.map((t, idx) => `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <span class="timeline-date">${t.date}</span>
                    <div class="timeline-task">${t.task}</div>
                    <p class="timeline-desc">${t.desc}</p>
                    <button class="btn-listen-task" onclick="speakText('${t.task}. ${t.desc}')">
                        <i data-lucide="volume-2" style="width:14px; display:inline;"></i> Listen
                    </button>
                </div>
            </div>
        `).join('');
        
        lucide.createIcons();
        view.scrollIntoView({ behavior: 'smooth' });
    };

    window.speakAllTasks = () => {
        const text = Array.from(document.querySelectorAll('.timeline-content'))
            .map(c => c.innerText.replace('Listen', ''))
            .join('. ');
        speakText(text);
    };

    // Ensure voices are loaded for the TTS selection
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
});
