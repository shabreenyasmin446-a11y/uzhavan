// Uzhavan frontend logic backed by the FastAPI service in app.py
document.addEventListener('DOMContentLoaded', () => {
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const API_BASE_URL = (window.UZHAVAN_API_BASE_URL || (isLocalHost && window.location.port !== '8000' ? 'http://127.0.0.1:8000' : '')).replace(/\/+$/, '');

    async function apiRequest(path, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (options.body && typeof options.body === 'string') headers['Content-Type'] = 'application/json';
        const token = sessionStorage.getItem('uzhavanDemoToken');
        if (token) headers.Authorization = `Bearer ${token}`;
        return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    }

    function headersForBackendUrl(url) {
        const headers = {};
        const token = sessionStorage.getItem('uzhavanDemoToken');
        const apiOrigin = API_BASE_URL ? new URL(API_BASE_URL).origin : window.location.origin;
        if (token && new URL(url, window.location.href).origin === apiOrigin) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    async function responseError(response) {
        try {
            const body = await response.json();
            return body.detail || `Request failed (${response.status})`;
        } catch {
            return `Request failed (${response.status})`;
        }
    }

    async function refreshBackendStatus() {
        const status = document.getElementById('backend-status');
        if (!status) return;
        try {
            const response = await apiRequest('/health');
            if (!response.ok) throw new Error('Backend health check failed');
            const health = await response.json();
            const smsMode = health.auth_mode === 'sms';
            status.innerText = smsMode
                ? 'Backend connected · SMS verification enabled.'
                : 'Backend connected · demo login only · no SMS is sent.';
            status.style.color = '#1B5E20';
            document.getElementById('txt-enter-phone').innerText = smsMode
                ? 'Enter your mobile number. We will send a one-time code by SMS.'
                : 'Enter any 10-digit number for the demo login. No SMS is sent.';
            document.getElementById('txt-get-otp').innerText = smsMode ? 'Send verification code' : 'Get demo code';
            document.getElementById('txt-enter-code').innerText = smsMode
                ? 'Enter the six-digit code sent to your mobile number.'
                : 'Enter the demo code shown below. No message is sent.';
            document.getElementById('txt-resend').innerText = smsMode ? 'Send another code' : 'Generate another demo code';
        } catch {
            status.innerText = 'Backend not connected. Start the server using README.md.';
            status.style.color = '#a33';
        }
    }

    refreshBackendStatus();

    // Basic Navigation Setup
    const pages = document.querySelectorAll('.page');
    const navBtns = {
        'nav-dashboard': 'dashboard-page',
        'nav-market': 'market-page',
        'nav-pest': 'pest-page',
        'nav-water': 'water-page',
        'nav-scheduler': 'scheduler-page'
    };

    document.getElementById('btn-open-pest-page')?.addEventListener('click', () => showPage('pest-page'));

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

    // -----------------------
    // LOGIN FLOW
    // -----------------------
    let generatedOTP = "";
    const btnGetOtp = document.getElementById('btn-get-otp');
    const stepPhone = document.getElementById('step-phone');
    const stepOtp = document.getElementById('step-otp');
    const btnVerify = document.getElementById('btn-verify');
    const otpInput = document.getElementById('otp-input');
    const otpStatusMsg = document.getElementById('otp-status-msg');

    async function issueVerificationCode() {
        const phone = document.getElementById('placeholder-phone').value.trim();
        const countryCode = document.querySelector('.country-code')?.value || '+91';
        if (!/^\d{10}$/.test(phone)) {
            alert('Enter a valid 10-digit mobile number.');
            return;
        }

        let result;
        try {
            const response = await apiRequest('/api/login', {
                method: 'POST',
                body: JSON.stringify({ phone, country_code: countryCode })
            });
            if (!response.ok) throw new Error(await responseError(response));
            result = await response.json();
            generatedOTP = result.demo_code || '';
        } catch (error) {
            alert(`Could not send a verification code. Check the backend and try again. (${error.message})`);
            return;
        }

        stepPhone.style.display = 'none';
        stepOtp.style.display = 'block';
        if (otpStatusMsg) {
            otpStatusMsg.innerText = resultMessage(result);
            otpStatusMsg.style.color = '#1B5E20';
        }
        otpInput?.focus();
    }

    function resultMessage(result) {
        return result.demo_code
            ? `${result.message} Demo code: ${result.demo_code}`
            : result.message;
    }

    btnGetOtp?.addEventListener('click', issueVerificationCode);
    document.getElementById('btn-resend-otp')?.addEventListener('click', issueVerificationCode);
    document.getElementById('btn-back')?.addEventListener('click', () => {
        generatedOTP = '';
        if (stepOtp) stepOtp.style.display = 'none';
        if (stepPhone) stepPhone.style.display = 'block';
    });

    if (btnVerify) {
        btnVerify.addEventListener('click', async () => {
            const userInput = otpInput ? otpInput.value : "";
            const phone = document.getElementById('placeholder-phone').value.trim();
            const countryCode = document.querySelector('.country-code')?.value || '+91';

            try {
                const response = await apiRequest('/api/verify-otp', {
                    method: 'POST',
                    body: JSON.stringify({ phone, otp: userInput, country_code: countryCode })
                });
                if (!response.ok) throw new Error(await responseError(response));
                const result = await response.json();
                sessionStorage.setItem('uzhavanDemoToken', result.token);
                generatedOTP = '';
                const navGroup = document.getElementById('app-navigation');
                if (navGroup) navGroup.style.display = 'block';
                showPage('dashboard-page');
                document.getElementById('nav-dashboard').classList.add('active-nav');
                initDashboard();
            } catch (error) {
                alert(error.message || 'Could not verify the demo code.');
                if (otpStatusMsg) {
                    otpStatusMsg.innerText = error.message || 'Incorrect demo code. Please try again.';
                    otpStatusMsg.style.color = "#FF3333";
                }
            }
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try { await apiRequest('/api/logout', { method: 'POST' }); } catch {}
            sessionStorage.removeItem('uzhavanDemoToken');
            generatedOTP = '';
            const navGroup = document.getElementById('app-navigation');
            if (navGroup) navGroup.style.display = 'none';
            showPage('login-page');
            if(stepOtp) stepOtp.style.display = 'none';
            if(stepPhone) stepPhone.style.display = 'block';
        });
    }

    // -----------------------
    // Example listings and live weather initialization
    // -----------------------
    async function initDashboard() {
        try {
            const [schemesResponse, banksResponse] = await Promise.all([
                apiRequest('/api/schemes'),
                apiRequest('/api/banks')
            ]);
            if (!schemesResponse.ok) throw new Error(await responseError(schemesResponse));
            if (!banksResponse.ok) throw new Error(await responseError(banksResponse));
            SCHEMES = await schemesResponse.json();
            BANKS = await banksResponse.json();
            renderSchemes();
            renderBanks();
        } catch (error) {
            const schemesList = document.getElementById('schemes-list');
            const banksList = document.getElementById('banks-list');
            if (schemesList) schemesList.innerText = `Could not load scheme information from the backend: ${error.message}`;
            if (banksList) banksList.innerText = 'Backend bank information is unavailable.';
        }
        renderMandi();
        updateWeather();
        refreshWaterWeather();
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
        temperature: null,
        humidity: null,
        rainfall: null,
        moisture: null,
        rainForecast: 'Weather forecast not loaded.'
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
            if (!geoResponse.ok) throw new Error('Weather location lookup failed');
            const geoData = await geoResponse.json();
            const place = geoData?.results?.[0];
            if (!place) throw new Error('Location not found');

            const lat = place.latitude;
            const lon = place.longitude;
            const forecastResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,precipitation&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=precipitation_sum&timezone=auto`);
            if (!forecastResponse.ok) throw new Error('Weather service is unavailable');
            const data = await forecastResponse.json();
            const current = data.current || data.current_weather || {};
            const humidity = current.relative_humidity_2m ?? (Array.isArray(data.hourly?.relativehumidity_2m) ? data.hourly.relativehumidity_2m[0] : 60);
            const rainfall = Array.isArray(data.hourly?.precipitation) ? data.hourly.precipitation[0] : 0;
            const dailyRain = Array.isArray(data.daily?.precipitation_sum) ? data.daily.precipitation_sum[0] : 0;
            const currentTemperature = current.temperature_2m ?? current.temperature ?? 26;
            const moisture = Math.max(20, Math.min(80, 52 + ((humidity - 55) * 0.35) - ((currentTemperature - 26) * 0.5)));

            return {
                temperature: Math.round(current.temperature_2m ?? current.temperature ?? 28),
                humidity: Math.round(current.relative_humidity_2m ?? humidity),
                rainfall: Number((current.precipitation ?? rainfall).toFixed(1)),
                dailyRain: Number(dailyRain.toFixed(1)),
                wind: Math.round(current.wind_speed_10m ?? current.windspeed ?? 0),
                weatherCode: current.weather_code ?? 0,
                moisture: Math.round(moisture),
                rainForecast: dailyRain > 8 ? `Rain likely: ${dailyRain.toFixed(1)} mm expected today.` : `${dailyRain.toFixed(1)} mm rain expected today.`
            };
        } catch (err) {
            console.warn('Forecast fetch failed', err);
            return null;
        }
    }

    function updateWaterWeatherDisplay() {
        const display = value => Number.isFinite(value) ? value : '—';
        if (document.getElementById('water-weather-temp')) document.getElementById('water-weather-temp').innerText = `${display(waterWeatherState.temperature)}°C`;
        if (document.getElementById('water-weather-humidity')) document.getElementById('water-weather-humidity').innerText = `${display(waterWeatherState.humidity)}%`;
        if (document.getElementById('water-weather-rain')) document.getElementById('water-weather-rain').innerText = `${display(waterWeatherState.rainfall)} mm`;
        if (document.getElementById('water-weather-moisture')) document.getElementById('water-weather-moisture').innerText = `${display(waterWeatherState.moisture)}%`;
        if (document.getElementById('water-rain-forecast')) document.getElementById('water-rain-forecast').innerText = waterWeatherState.rainForecast;
    }

    async function refreshWaterWeather() {
        const locationLabel = waterLocationInput ? waterLocationInput.value : 'Chennai, TN';
        const forecast = await fetchWeatherForecastForLocation(locationLabel);
        if (forecast) {
            waterWeatherState = forecast;
        } else {
            waterWeatherState.rainForecast = 'Live forecast unavailable. Check a local forecast before planning irrigation.';
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

        const weatherTemperature = waterWeatherState.temperature ?? 28;
        const weatherHumidity = waterWeatherState.humidity ?? 55;
        const weatherRain = waterWeatherState.rainfall ?? 0;
        const weatherAdjustment = 1 + Math.max(0, (weatherTemperature - 30) * 0.025) - Math.min(0.25, Math.max(0, (weatherHumidity - 55) * 0.0025)) - Math.min(0.4, weatherRain * 0.03);
        const adjustedWeather = Math.max(0.65, Math.min(1.35, weatherAdjustment));

        let dailyLiters = areaM2 * baseETo * stageMultiplier * soilFactor * adjustedWeather;
        dailyLiters = Math.max(150, dailyLiters * 0.95 / methodEfficiency);
        const weeklyLiters = dailyLiters * 7;

        const recommendedMethod = weatherRain > 8 ? 'Drip Irrigation' : method;
        const efficiencyScore = Math.max(55, Math.round((methodEfficiency * 100) - ((weatherRain > 8 ? 5 : 0))));

        const dailyBar = Math.min(100, Math.round((dailyLiters / 12000) * 100));
        const weeklyBar = Math.min(100, Math.round((weeklyLiters / 84000) * 100));

        if (document.getElementById('water-daily')) document.getElementById('water-daily').innerText = `${Math.round(dailyLiters).toLocaleString()} L`;
        if (document.getElementById('water-weekly')) document.getElementById('water-weekly').innerText = `${Math.round(weeklyLiters).toLocaleString()} L`;
        if (document.getElementById('water-recommended-method')) document.getElementById('water-recommended-method').innerText = recommendedMethod;
        if (document.getElementById('water-efficiency-score')) document.getElementById('water-efficiency-score').innerText = `${efficiencyScore}%`;
        if (document.getElementById('water-bar-daily')) document.getElementById('water-bar-daily').style.height = `${Math.max(18, dailyBar)}%`;
        if (document.getElementById('water-bar-weekly')) document.getElementById('water-bar-weekly').style.height = `${Math.max(18, weeklyBar)}%`;

        const schedule = [
            { time: 'Today', note: `Planning estimate: about ${Math.round(dailyLiters).toLocaleString()} L. Check field soil moisture before irrigating.` },
            { time: 'Next 2 Days', note: 'Review the latest local forecast and soil moisture; recalculate if conditions change.' },
            { time: 'Midweek', note: `Review the selected ${recommendedMethod} method and adjust using local guidance.` },
            { time: 'Weekend', note: 'Recheck soil moisture and avoid extra watering if the field is already wet.' }
        ];

        const tips = [
            `Prefer ${recommendedMethod} for higher water efficiency.`,
            'Irrigate in the early morning or late evening to reduce evaporation.',
            weatherRain > 5 ? 'Delay heavy irrigation because rain is expected soon.' : 'Use mulching to retain soil moisture.',
            'Check soil moisture before every irrigation to avoid overwatering.'
        ];

        const alerts = [];
        if (!Number.isFinite(waterWeatherState.temperature)) alerts.push({type:'warning', text:'Current weather did not load. This estimate uses neutral weather assumptions.'});
        if (weatherRain > 8) alerts.push({type:'info', text:'Rain detected — review irrigation needs today.'});
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

    async function updateWeather() {
        const location = document.getElementById('location-input')?.value || 'Chennai, TN';
        const status = document.getElementById('txt-weather-status');
        if (status) status.innerText = 'Loading weather…';
        const forecast = await fetchWeatherForecastForLocation(location);
        if (!forecast) {
            if (status) status.innerText = 'Weather unavailable';
            ['weather-temp', 'weather-humid', 'weather-wind', 'weather-rain'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = '—';
            });
            return;
        }

        const weatherText = code => {
            if (code === 0) return ['Clear', 'sun'];
            if (code <= 3) return ['Partly cloudy', 'cloud-sun'];
            if (code <= 48) return ['Foggy', 'cloud-fog'];
            if (code <= 67 || (code >= 80 && code <= 82)) return ['Rain', 'cloud-rain'];
            if (code >= 71 && code <= 77) return ['Snow', 'cloud-snow'];
            if (code >= 95) return ['Thunderstorm', 'cloud-lightning'];
            return ['Current conditions', 'cloud'];
        };
        const [description, icon] = weatherText(forecast.weatherCode);
        document.getElementById('weather-temp').innerText = forecast.temperature;
        document.getElementById('weather-humid').innerText = forecast.humidity;
        document.getElementById('weather-wind').innerText = forecast.wind;
        document.getElementById('weather-rain').innerText = forecast.dailyRain.toFixed(1);
        if (status) status.innerText = description;
        const weatherIcon = document.getElementById('weather-icon');
        if (weatherIcon) {
            weatherIcon.setAttribute('data-lucide', icon);
            window.lucide?.createIcons();
        }
    }

    let SCHEMES = [];

    window.openSchemePage = (schemeName) => {
        const scheme = SCHEMES.find(s => s.name === schemeName);
        if (scheme?.link) window.open(scheme.link, '_blank', 'noopener,noreferrer');
    };

    let BANKS = [];

    function renderSchemes() {
        const container = document.getElementById('schemes-list');
        if(!container) return;
        
        container.innerHTML = SCHEMES.map(s => `
                <div class="scheme-card card" style="padding: 15px; margin-bottom: 10px; border: 1px solid rgba(255, 255, 255, 0.08); position: relative;">
                <span class="badge badge-success">${s.tags}</span>
                <h4 style="margin: 8px 0; color: #1B5E20;">${s.name}</h4>
                <p style="font-size: 0.9rem;">${s.desc}</p>
                <button class="btn btn-outline" style="width: 100%; margin-top: 10px; padding: 8px;" onclick="openSchemePage('${s.name}')">View official details / apply</button>
            </div>
        `).join('');
        lucide.createIcons(); // re-create icons in dynamically injected HTML
    }

    function renderBanks() {
        const container = document.getElementById('banks-list');
        if(!container) return;
        container.innerHTML = BANKS.map(b => `
            <div class="bank-card card" style="padding: 15px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="margin: 0; color: #1B5E20;">${b.name}</h4>
                    <p style="font-size: 0.8rem; color: #666;">${b.dist} · no nearby location lookup</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 0.8rem; margin:0;">Current terms</p>
                    <strong style="color: var(--primary); font-size:0.75rem;">${b.rate}</strong>
                </div>
            </div>
        `).join('');
    }

    function renderMandi() {
        const container = document.getElementById('mandi-grid');
        if(!container) return;
        container.innerHTML = `<div class="card" style="padding:24px;">
            <h3 style="margin-top:0;color:#1B5E20;">Get current mandi prices</h3>
            <p>Uzhavan does not currently fetch live market prices. Check the date, mandi, commodity, and unit on the official e-NAM price page before comparing prices.</p>
            <a class="btn btn-primary" href="https://www.enam.gov.in/web/dashboard/live_price" target="_blank" rel="noopener noreferrer">Open e-NAM live prices</a>
        </div>`;
    }

    // -----------------------
    // Preset multilingual quick answers
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
                'default': "मैं उज़्हवन का त्वरित सहायता FAQ हूँ। 'पीएम किसान', 'कीट', 'खाद' या 'ऋण' के बारे में पूछें।",
                'schemes': "आप डैशबोर्ड अनुभाग में पीएम-किसान जैसी उपलब्ध योजनाएं देख सकते हैं।",
                'loans': "कृषि ऋण की मौजूदा शर्तों के लिए स्थानीय बैंक से संपर्क करें।",
                'pests': "फसल रोग की फोटो पहचान इस डेमो में उपलब्ध नहीं है।"
            },
            'ta': {
                'greeting': "வணக்கம்! உங்களுக்கு என்ன உதவி தேவை என்று சொல்லுங்கள்.",
                'default': "நான் உழவனின் விரைவு உதவி FAQ. 'PM கிசான்', 'பூச்சி', 'உரம்' அல்லது 'கடன்' பற்றி கேளுங்கள்.",
                'schemes': "டாஷ்போர்டு பிரிவில் PM-கிசான் போன்ற திட்டங்களை நீங்கள் பார்க்கலாம்.",
                'loans': "விவசாயக் கடன்களின் தற்போதைய விதிமுறைகளுக்கு உள்ளூர் வங்கியை அணுகுங்கள்.",
                'pests': "இந்த டெமோவில் பயிர் நோயை புகைப்படம் மூலம் அடையாளம் காண முடியாது."
            },
            'en': {
                'greeting': "Hello! Let me know what you need help with.",
                'default': "I am Uzhavan's quick help FAQ. Try asking about PM-Kisan, pests, fertilizer, or loans.",
                'schemes': "You can view available schemes like PM-Kisan in the Dashboard section.",
                'loans': "Ask a local bank about current KCC and agricultural loan terms.",
                'pests': "Photo-based crop disease identification is not available in this demo."
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
            const userMessage = document.createElement('div');
            userMessage.className = 'message';
            userMessage.style.cssText = 'background:rgba(46,125,50,0.4); padding:12px 16px; border-radius:16px 16px 4px 16px; margin-bottom:12px; align-self:flex-end; width:fit-content; margin-left:auto; color:white;';
            userMessage.textContent = val;
            messages.appendChild(userMessage);
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
    // EXPERIMENTAL OBJECT DETECTOR
    // -----------------------
    const btnAnalyze = document.getElementById('btn-analyze-pest');
    const resultBox = document.getElementById('pest-scan-preview');
    if(btnAnalyze) {
        btnAnalyze.addEventListener('click', async () => {
            const input = document.getElementById('pest-image-input');
            const file = input?.files?.[0];
            if (!file) {
                resultBox.innerText = 'Choose an image first.';
                return;
            }
            const endpoint = modelUrlInput?.value.trim();
            if (detectModeSelect?.value !== 'remote' || !endpoint || endpoint === 'coco-ssd') {
                resultBox.innerText = 'To analyze an image, select Remote model and enter your detector URL. The built-in model is a general object detector, not a crop disease model.';
                return;
            }

            resultBox.innerText = 'Sending this image to the remote detector you configured…';
            try {
                const form = new FormData();
                form.append('file', file, file.name);
                const response = await fetch(endpoint, { method: 'POST', headers: headersForBackendUrl(endpoint), body: form });
                if (!response.ok) throw new Error(`Server returned ${response.status}`);
                const payload = await response.json();
                const detections = Array.isArray(payload.detections) ? payload.detections : [];
                resultBox.replaceChildren();
                const notice = document.createElement('p');
                notice.innerText = detections.length
                    ? 'Experimental model labels (not a crop diagnosis):'
                    : 'The configured model returned no object labels.';
                resultBox.appendChild(notice);
                const list = document.createElement('ul');
                detections.forEach(item => {
                    const row = document.createElement('li');
                    const confidence = Number(item.score ?? item.confidence);
                    row.innerText = `${item.class || item.label || 'Object'}${Number.isFinite(confidence) ? ` (${Math.round(confidence * 100)}% model score)` : ''}`;
                    list.appendChild(row);
                });
                resultBox.appendChild(list);
            } catch (error) {
                resultBox.innerText = `Could not reach the configured detector: ${error.message}. Start the server and check its URL.`;
            }
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
            if (detectModeSelect?.value === 'remote') {
                try {
                    const endpoint = new URL(val);
                    const healthUrl = new URL('/health', endpoint.origin);
                    liveStatus.innerText = 'Checking remote server…';
                    const response = await fetch(healthUrl);
                    if (!response.ok) throw new Error(`Health check returned ${response.status}`);
                    const health = await response.json();
                    if (health.model_loaded === false) throw new Error('Server is running, but its model did not load');
                    liveStatus.innerText = 'Remote server is ready. Model labels are experimental.';
                    btnStartLive.disabled = false;
                    btnStopLive.disabled = true;
                } catch (error) {
                    liveStatus.innerText = `Remote server check failed: ${error.message}`;
                    btnStartLive.disabled = true;
                }
                return;
            }
            liveStatus.innerText = 'Preparing to load model...';
            await loadModel(val);
        });

        async function startCamera() {
            try {
                liveStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
                liveVideo.srcObject = liveStream;
                await liveVideo.play();
                liveContainer.style.display = 'block';
                liveOverlay.width = liveVideo.videoWidth;
                liveOverlay.height = liveVideo.videoHeight;
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
            if (remoteRunning) return;
            const serverUrl = document.getElementById('model-url').value.trim();
            if (!serverUrl) {
                liveStatus.innerText = 'Remote server URL required.';
                return;
            }
            if (!liveVideo || liveVideo.readyState < 2) return;

            try {
                remoteRunning = true;
                // capture current frame to blob
                const off = document.createElement('canvas');
                off.width = liveVideo.videoWidth;
                off.height = liveVideo.videoHeight;
                const ctxOff = off.getContext('2d');
                ctxOff.drawImage(liveVideo, 0, 0, off.width, off.height);

                const blob = await new Promise(resolve => off.toBlob(resolve, 'image/jpeg', 0.8));

                const form = new FormData();
                form.append('file', blob, 'camera-frame.jpg');
                const resp = await fetch(serverUrl, {
                    method: 'POST',
                    headers: headersForBackendUrl(serverUrl),
                    body: form
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
            } finally {
                remoteRunning = false;
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
                detectionInterval = setInterval(runDetectionRemote, 700);
            }
        });

        btnStopLive?.addEventListener('click', () => {
            if (detectionInterval) { clearInterval(detectionInterval); detectionInterval = null; }
            remoteRunning = false;
            stopCamera();
            btnStartLive.disabled = false;
            btnStopLive.disabled = true;
            liveStatus.innerText = detectModeSelect?.value === 'remote' ? 'Remote detector stopped.' : 'Model loaded. Live stopped.';
            if (overlayCtx) overlayCtx.clearRect(0,0,liveOverlay.width, liveOverlay.height);
        });

    // -----------------------
    // CROP SCHEDULER LOGIC
    // -----------------------
    const btnGenerateSched = document.getElementById('btn-generate-sched');
    const schedulerMonth = document.getElementById('sched-month');
    if (schedulerMonth) {
        schedulerMonth.value = new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date());
    }
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
                { date: 'Before planting', task: 'Prepare the field', desc: 'Prepare and level the field using local soil and water guidance.' },
                { date: 'Nursery and establishment', task: 'Sow or transplant', desc: 'Use locally recommended seed and transplanting timing for your variety.' },
                { date: 'Vegetative growth', task: 'Check water', desc: 'Monitor field moisture and follow local water-saving recommendations.' },
                { date: 'Growing period', task: 'Plan nutrients', desc: 'Use soil-test results or local agriculture office advice for fertilizer type and amount.' },
                { date: 'Growing period', task: 'Scout for pests', desc: 'Check plants regularly and get a local identification before any treatment.' },
                { date: 'Maturity', task: 'Harvest', desc: 'Harvest when your variety reaches local maturity signs and prepare grain for safe storage.' }
            ]
        },
        'Tomato': {
            icon: 'carrot',
            tasks: [
                { date: 'Before planting', task: 'Prepare the beds', desc: 'Prepare well-drained beds and use soil-test or local extension guidance.' },
                { date: 'Establishment', task: 'Transplant seedlings', desc: 'Use healthy seedlings and locally recommended spacing for your variety.' },
                { date: 'Vegetative growth', task: 'Support and water', desc: 'Support plants as needed and monitor soil moisture.' },
                { date: 'Growing period', task: 'Plan nutrients', desc: 'Use soil-test results or local agriculture office advice for fertilizer type and amount.' },
                { date: 'Flowering and fruiting', task: 'Scout for pests', desc: 'Inspect plants regularly and get local pest identification before treatment.' },
                { date: 'Harvest period', task: 'Pick ripe fruit', desc: 'Harvest fruit at the maturity stage preferred for your market.' }
            ]
        },
        'Wheat': {
            icon: 'wheat',
            tasks: [
                { date: 'Before sowing', task: 'Prepare the field', desc: 'Clear previous crop residue as appropriate and prepare a level seedbed.' },
                { date: 'Sowing', task: 'Plant the crop', desc: 'Use locally recommended seed, depth, and spacing for your variety.' },
                { date: 'Early growth', task: 'Check crop establishment', desc: 'Inspect emergence and weeds; seek local advice before using any herbicide.' },
                { date: 'Growing period', task: 'Manage water and nutrients', desc: 'Follow soil-test and local irrigation recommendations for your district.' },
                { date: 'Maturity', task: 'Harvest and store', desc: 'Harvest at locally recommended maturity and dry grain safely before storage.' }
            ]
        },
        'Groundnut': {
            icon: 'leaf',
            tasks: [
                { date: 'Before sowing', task: 'Prepare the field', desc: 'Choose a well-drained field and use locally recommended seed and spacing.' },
                { date: 'Sowing', task: 'Plant the crop', desc: 'Sow at the locally recommended time and depth; avoid waterlogging.' },
                { date: 'Early growth', task: 'Check weeds and plant stand', desc: 'Remove weeds while plants are small and replace gaps if practical.' },
                { date: 'Flowering and pegging', task: 'Check soil moisture', desc: 'Keep soil moisture steady and avoid disturbing pegs near the soil surface.' },
                { date: 'Maturity', task: 'Harvest and dry', desc: 'Harvest when plants and pods show local maturity signs, then dry pods safely.' }
            ]
        },
        'Maize': {
            icon: 'wheat',
            tasks: [
                { date: 'Before sowing', task: 'Prepare and plan', desc: 'Use suitable locally recommended seed and ensure the field drains well.' },
                { date: 'Sowing', task: 'Plant in rows', desc: 'Follow the seed packet or local agriculture office for spacing and depth.' },
                { date: 'Early growth', task: 'Weed and inspect', desc: 'Control weeds early and look for uneven emergence or crop damage.' },
                { date: 'Tasseling and silking', task: 'Avoid moisture stress', desc: 'Check the crop regularly; this stage is sensitive to dry conditions.' },
                { date: 'Maturity', task: 'Harvest and dry', desc: 'Harvest when locally recommended maturity signs appear; dry grain before storage.' }
            ]
        },
        'Sugarcane': {
            icon: 'leaf',
            tasks: [
                { date: 'Before planting', task: 'Prepare the field', desc: 'Select healthy planting material and confirm the suitable variety and season locally.' },
                { date: 'Planting', task: 'Plant setts', desc: 'Use disease-free setts and the spacing advised by your local agriculture office.' },
                { date: 'Establishment', task: 'Check gaps and weeds', desc: 'Check germination, fill gaps where appropriate, and manage weeds early.' },
                { date: 'Growing period', task: 'Monitor water and crop health', desc: 'Avoid waterlogging and inspect regularly for pests or disease symptoms.' },
                { date: 'Maturity', task: 'Harvest at the right time', desc: 'Follow local mill or agriculture office guidance for harvest timing and delivery.' }
            ]
        },
        'Cotton': {
            icon: 'flower',
            tasks: [
                { date: 'Before sowing', task: 'Check season and seed', desc: 'Use locally approved seed and confirm the sowing window for your district.' },
                { date: 'Sowing', task: 'Plant and record', desc: 'Follow local spacing guidance and keep the seed label for reference.' },
                { date: 'Early growth', task: 'Scout the field', desc: 'Inspect both sides of leaves regularly and record any pest or disease signs.' },
                { date: 'Flowering and boll formation', task: 'Continue monitoring', desc: 'Check crop moisture and scout frequently; ask an expert before treatment.' },
                { date: 'Boll opening', task: 'Pick clean cotton', desc: 'Harvest open bolls in dry conditions and keep picked cotton clean.' }
            ]
        },
        'Chickpea': {
            icon: 'leaf',
            tasks: [
                { date: 'Before sowing', task: 'Prepare and select seed', desc: 'Use a suitable locally recommended variety and a well-drained field.' },
                { date: 'Sowing', task: 'Plant at the advised time', desc: 'Follow local guidance for seed treatment, spacing, and sowing depth.' },
                { date: 'Early growth', task: 'Control weeds', desc: 'Keep the crop free of weeds while seedlings establish.' },
                { date: 'Flowering and pod setting', task: 'Scout for crop problems', desc: 'Inspect the field regularly and get advice before using any pesticide.' },
                { date: 'Maturity', task: 'Harvest and store dry', desc: 'Harvest when plants dry down and pods mature; dry grain before storage.' }
            ]
        },
        'Mustard': {
            icon: 'flower',
            tasks: [
                { date: 'Before sowing', task: 'Prepare the seedbed', desc: 'Confirm a locally suitable variety and sowing window.' },
                { date: 'Sowing', task: 'Sow evenly', desc: 'Use seed rate and spacing recommended for your region and variety.' },
                { date: 'Early growth', task: 'Thin and weed if needed', desc: 'Maintain a healthy crop stand and remove competing weeds.' },
                { date: 'Flowering and pod development', task: 'Scout the crop', desc: 'Inspect for pests and disease; seek local advice before treatment.' },
                { date: 'Maturity', task: 'Harvest carefully', desc: 'Harvest when pods mature but before excessive shattering; dry before storage.' }
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
        const crops = MONTHLY_RECOMMENDATIONS[month] || ['Paddy (Rice)', 'Tomato', 'Wheat'];
        
        list.innerHTML = crops.map(c => `
            <div class="card" style="padding: 15px; cursor: pointer; border-color: rgba(46, 204, 113, 0.2);" onclick="showDetailedSchedule('${c}')">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="background: rgba(46, 204, 113, 0.2); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="leaf" style="color: #2ECC71;"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0;">${c}</h4>
                        <p style="font-size: 0.8rem; margin: 0;">General starter checklist for ${location}; local season guidance may differ.</p>
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
        
        if (!CROP_SCHED_DATA[crop]) return;

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
