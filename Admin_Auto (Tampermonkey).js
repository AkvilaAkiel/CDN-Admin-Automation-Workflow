// ==UserScript==
// @name         MEGOGO CPanel (Events & Channels) v2.1
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Універсальний комбайн: Пріоритет CDN ID для роутингу, актуальні бази, AI Ready
// @author       Akvila
// @match        ** //Посилання на адмінку
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // ==========================================
    // 🛠 СПІЛЬНІ УТИЛІТИ
    // ==========================================
    const setAngularValue = (element, value) => {
        if (!element) return;
        if (element.hasAttribute('disabled')) element.removeAttribute('disabled');
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // ==========================================
    // ⚙️ БАЗА ДАНИХ (ПОДІЇ)
    // ==========================================
    const EVENT_BLACKOUT_CONFIG = {
        //Назви та посилання на технічні заглушки на сервері
    };

    // ==========================================
    // ⚙️ БАЗА ДАНИХ (ТЕЛЕКАНАЛИ)
    // ==========================================
    const CHANNEL_MAP = {
        //IDs, назви та посилання на технічні заглушки телеканалів що підпадають під Blackout контенту згідно з вимогами ПВ
    };

    // =====================================================================================
    // 🟦 ЛОГІКА 1: СТОРІНКА ПОДІЙ (DVR, Audio, Event Blackouts, Thumbnails)
    // =====================================================================================
    async function setCalendarTime(dropdownSelector, dateObj, label) {
        let targetDay = dateObj.getDate().toString();
        let targetHour = dateObj.getHours().toString() + ':00';
        let targetMinute = dateObj.getHours().toString() + ':' + dateObj.getMinutes().toString().padStart(2, '0');

        const dropdown = document.querySelector(`.live-event-dvr-schedule-container ${dropdownSelector}`);
        if (!dropdown) throw new Error(`Не знайдено блок ${dropdownSelector}`);

        const calBtn = dropdown.querySelector('button');
        if (calBtn.hasAttribute('disabled') || calBtn.getAttribute('enabled') === 'false') {
            calBtn.removeAttribute('disabled');
            calBtn.setAttribute('enabled', 'true');
        }

        calBtn.click();
        await sleep(500);

        const calendarArea = dropdown.closest('.dropdown1');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let expectedHeader = `${dateObj.getFullYear()}-${monthNames[dateObj.getMonth()]}`;

        for (let i = 0; i < 12; i++) {
            let switchTh = calendarArea.querySelector('th.switch');
            if (!switchTh) break;
            if (switchTh.textContent.trim() === expectedHeader) break;

            let [cYear, cMonthStr] = switchTh.textContent.trim().split('-');
            let goRight = (dateObj.getFullYear() > parseInt(cYear) || (dateObj.getFullYear() === parseInt(cYear) && dateObj.getMonth() > monthNames.indexOf(cMonthStr)));
            let navBtn = calendarArea.querySelector(goRight ? 'th.right' : 'th.left');
            if (navBtn) { navBtn.click(); await sleep(300); } else break;
        }

        let days = Array.from(calendarArea.querySelectorAll('td.day:not(.past):not(.future)'));
        let dayBtn = days.find(el => el.textContent.trim() === targetDay);
        if (dayBtn) { dayBtn.click(); await sleep(400); }

        let hours = Array.from(calendarArea.querySelectorAll('span.hour'));
        let hourBtn = hours.find(el => el.textContent.trim() === targetHour);
        if (hourBtn) { hourBtn.click(); await sleep(400); }

        let minutes = Array.from(calendarArea.querySelectorAll('span.minute'));
        let minuteBtn = minutes.find(el => el.textContent.trim() === targetMinute);
        if (minuteBtn) minuteBtn.click();
        await sleep(300);
    }

    async function runAutoDVR() {
        try {
            const titleInput = document.querySelector('#fld-name');
            const match = titleInput.value.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
            if (!match) return alert("❌ Не знайдено дату/час у назві!");

            let [_, d, m, y, h, min] = match;
            let currentYear = new Date().getFullYear();
            if (parseInt(y, 10) !== currentYear) return alert(`❌ Критична помилка: Рік у назві (${y}) не збігається з поточним!`);

            let baseDate = new Date(y, parseInt(m) - 1, d, h, min);
            let startDate = new Date(baseDate.getTime() - 10 * 3600000);
            let finishDate = new Date(baseDate.getTime() + 10 * 3600000);

            await setCalendarTime('#dvr_dropdownStart0', startDate, 'СТАРТ');
            await setCalendarTime('#dvr_dropdownFinish0', finishDate, 'ФІНІШ');
        } catch (error) { alert("❌ Помилка DVR: " + error.message); }
    }

    async function runAutoAudio() {
        const addBtn = document.querySelector('button[data-ng-click="audio_tracks.add();"]');
        if (!addBtn) return;
        for (let i = 0; i < 3; i++) { addBtn.click(); await sleep(300); }

        const rows = Array.from(document.querySelectorAll('div[data-ng-repeat*="audio_tracks_ex"]')).slice(-3);
        const configs = [
            { lang: 'ukr', name: 'Ukrainian', code: '173', def: true },
            { lang: 'all', name: 'Alternate', code: '5', def: false },
            { lang: 'qaa', name: 'InternationalSound', code: '68', def: false }
        ];

        rows.forEach((row, i) => {
            setAngularValue(row.querySelector('input[data-ng-model="audio_track.track_no"]'), '-1');
            setAngularValue(row.querySelector('input[data-ng-model="audio_track.lang"]'), configs[i].lang);
            setAngularValue(row.querySelector('input[data-ng-model="audio_track.lang_name"]'), configs[i].name);
            setAngularValue(row.querySelector('select[data-ng-model="audio_track.lang_code"]'), configs[i].code);
            if (configs[i].def) row.querySelector('input[type="radio"]')?.click();
        });
    }

    function toggleEventBlackoutPanel(forceState = null) {
        const panel = document.getElementById('qa-blackout-panel-inner');
        const bubble = document.getElementById('qa-blackout-bubble');
        if (!panel || !bubble) return;
        let isOpening = forceState !== null ? forceState : (panel.style.display === 'none');
        if (isOpening) {
            panel.style.display = 'flex'; bubble.style.display = 'none';
            localStorage.setItem('qaBlackoutPanelState', 'open');
        } else {
            panel.style.display = 'none'; bubble.style.display = 'flex';
            localStorage.setItem('qaBlackoutPanelState', 'closed');
        }
    }

    async function applyEventBlackouts() {
        const league = document.querySelector('#qa-blackout-select').value;
        const config = EVENT_BLACKOUT_CONFIG[league];
        if (!config) return alert('❌ Виберіть турнір зі списку!');

        setAngularValue(document.querySelector('#fld-failed_url'), config.tech);
        const blackoutBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Добавить новый blackout'));

        let currentBlackouts = document.querySelectorAll('.live-event-blackout');
        for (let i = 0; i < 2 - currentBlackouts.length; i++) {
            if (blackoutBtns[0]) blackoutBtns[0].click();
            await sleep(300);
        }

        const tables = document.querySelectorAll('.live-event-blackout');
        if (tables.length >= 2) {
            setAngularValue(tables[0].querySelector('select[name="blackout_type"]'), "0");
            setAngularValue(tables[0].querySelector('input[name="blackout_name"]'), "Начало");
            setAngularValue(tables[0].querySelector('input[name="blackout_url"]'), config.start);

            setAngularValue(tables[1].querySelector('select[name="blackout_type"]'), "1");
            setAngularValue(tables[1].querySelector('input[name="blackout_name"]'), "Окончание");
            setAngularValue(tables[1].querySelector('input[name="blackout_url"]'), config.end);

            let btnStart = tables[0].querySelector('button[ng-click="toggleBlackout($index)"]');
            if (btnStart && btnStart.textContent.includes('Включить')) btnStart.click();
        }

        const btn = document.querySelector('#qa-blackout-apply-btn');
        btn.innerHTML = "✅ Готово!"; btn.style.backgroundColor = "#27ae60";
    }

    function injectEventBlackoutUI() {
        if (document.querySelector('#qa-blackout-wrapper')) return;
        const savedState = localStorage.getItem('qaBlackoutPanelState') || 'closed';

        const wrapper = document.createElement('div');
        wrapper.id = 'qa-blackout-wrapper';
        wrapper.style.cssText = `position: fixed; bottom: 25px; right: 25px; z-index: 999999; font-family: Arial, sans-serif; display: none;`;

        const bubble = document.createElement('div');
        bubble.id = 'qa-blackout-bubble';
        bubble.innerHTML = '🎬';
        bubble.style.cssText = `width: 56px; height: 56px; background: #2c3e50; border-radius: 50%; display: ${savedState === 'closed' ? 'flex' : 'none'}; align-items: center; justify-content: center; font-size: 28px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.4); border: 2px solid #34495e; transition: transform 0.2s; user-select: none;`;
        bubble.onmouseover = () => bubble.style.transform = 'scale(1.1)';
        bubble.onmouseout = () => bubble.style.transform = 'scale(1)';
        bubble.onclick = () => toggleEventBlackoutPanel(true);

        const panel = document.createElement('div');
        panel.id = 'qa-blackout-panel-inner';
        panel.style.cssText = `background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); width: 250px; display: ${savedState === 'open' ? 'flex' : 'none'}; flex-direction: column; gap: 10px; border: 1px solid #34495e;`;

        panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #7f8c8d; padding-bottom: 5px;">
        <div style="font-size: 14px;">🎯 <b>Заглушки</b></div>
        <span id="qa-close-panel-btn" style="cursor: pointer; font-size: 16px; color: #bdc3c7; padding: 0 5px;">✖</span>
        </div>
        <datalist id="qa-league-list">
        ${Object.keys(EVENT_BLACKOUT_CONFIG).map(l => `<option value="${l}">`).join('')}
        </datalist>
        <div style="display: flex; gap: 5px; width: 100%;">
        <input id="qa-blackout-select" list="qa-league-list" placeholder="Почніть вводити лігу..." style="padding: 8px; border-radius: 4px; border: none; font-size: 13px; color: #333; flex-grow: 1; min-width: 0;">
        <button id="qa-clear-input-btn" style="background: #c0392b; color: white; border: none; border-radius: 4px; padding: 0 10px; cursor: pointer; font-size: 12px; transition: 0.2s;">✖</button>
        </div>
        <button id="qa-blackout-apply-btn" style="background: #d35400; color: white; border: none; padding: 10px; font-weight: bold; cursor: pointer; border-radius: 4px; transition: 0.2s;">⚡ Тиць ⚡</button>
        `;

        wrapper.appendChild(bubble);
        wrapper.appendChild(panel);
        document.body.appendChild(wrapper);

        document.getElementById('qa-close-panel-btn').onclick = () => toggleEventBlackoutPanel(false);
        document.getElementById('qa-clear-input-btn').onclick = () => { document.getElementById('qa-blackout-select').value = ''; document.getElementById('qa-blackout-select').focus(); };
        document.getElementById('qa-blackout-apply-btn').onclick = applyEventBlackouts;

        document.addEventListener('click', (event) => {
            if (event.isTrusted && panel.style.display === 'flex' && !wrapper.contains(event.target)) {
                toggleEventBlackoutPanel(false);
            }
        });
    }

    function renderThumbnails() {
        const allInputs = [];
        const techInput = document.querySelector('#fld-failed_url');
        if (techInput) allInputs.push(techInput);
        document.querySelectorAll('input[name="blackout_url"]').forEach(i => allInputs.push(i));

        allInputs.forEach(input => {
            const url = input.value;
            let existingThumb = input.parentNode.querySelector('.qa-auto-thumb');

            if (url && url.startsWith('http')) {
                if (!existingThumb) {
                    const img = document.createElement('img');
                    img.src = url;
                    img.className = 'qa-auto-thumb';
                    img.style.cssText = `height: 35px; margin-left: 10px; border-radius: 3px; border: 1px solid #bdc3c7; vertical-align: middle; transition: transform 0.2s; cursor: zoom-in; z-index: 100; position: relative; background: #fff;`;
                    img.onmouseover = () => { img.style.transform = 'scale(4) translateX(30%)'; img.style.zIndex = '9999'; };
                    img.onmouseout = () => { img.style.transform = 'scale(1) translateX(0)'; img.style.zIndex = '100'; };
                    input.parentNode.insertBefore(img, input.nextSibling);
                } else if (existingThumb.src !== url) {
                    existingThumb.src = url;
                }
            } else if (!url && existingThumb) {
                existingThumb.remove();
            }
        });
    }

    function handleEventPageLogic(inputField) {
        let audioAddBtn = document.querySelector('button[data-ng-click="audio_tracks.add();"]');
        if (audioAddBtn && !document.querySelector('#qa-audio-btn')) {
            let audioFieldset = audioAddBtn.closest('fieldset');
            if (audioFieldset) {
                let btnAudio = document.createElement('button');
                btnAudio.id = 'qa-audio-btn'; btnAudio.innerHTML = '🔊 Додати 3 Аудіодоріжки (Ukr/Alt/Int)';
                btnAudio.style.cssText = 'background-color: #2980b9; color: white; border: none; padding: 8px 15px; font-weight: bold; cursor: pointer; border-radius: 4px; margin-bottom: 15px; display: none;';
                btnAudio.onclick = runAutoAudio;
                audioFieldset.insertBefore(btnAudio, audioFieldset.firstChild);
            }
        }

        let dvrScheduleBlock = document.querySelector('.live-event-dvr-schedule-container');
        if (dvrScheduleBlock && !document.querySelector('#qa-dvr-btn')) {
            let btnDvr = document.createElement('button');
            btnDvr.id = 'qa-dvr-btn'; btnDvr.innerHTML = '⏱️ Встановити DVR (-10г | +10г)';
            btnDvr.style.cssText = 'background-color: #8e44ad; color: white; border: none; padding: 8px 15px; font-weight: bold; cursor: pointer; border-radius: 4px; margin-bottom: 15px; display: none;';
            btnDvr.onclick = runAutoDVR;
            let labels = Array.from(document.querySelectorAll('label, div')).filter(el => el.textContent && el.textContent.includes('DVR включен'));
            let targetGroup = labels.length > 0 ? labels[0].closest('.control-group') : null;
            if (targetGroup && targetGroup.parentNode) targetGroup.parentNode.insertBefore(btnDvr, targetGroup);
            else dvrScheduleBlock.parentNode.insertBefore(btnDvr, dvrScheduleBlock);
        }

        let warningDiv = document.querySelector('#qa-date-warning');
        if (!warningDiv) {
            warningDiv = document.createElement('div');
            warningDiv.id = 'qa-date-warning';
            warningDiv.style.cssText = 'color: #c0392b; font-weight: bold; margin-top: 8px; font-size: 14px; display: none; background: #fadbd8; padding: 5px; border-radius: 3px;';
            inputField.parentNode.appendChild(warningDiv);
        }

        injectEventBlackoutUI();
        renderThumbnails();

        const dateMatch = inputField.value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        let btnAudioEl = document.querySelector('#qa-audio-btn');
        let btnDvrEl = document.querySelector('#qa-dvr-btn');
        let blackoutWrapper = document.querySelector('#qa-blackout-wrapper');

        if (dateMatch) {
            if (btnAudioEl) btnAudioEl.style.display = 'inline-block';
            if (blackoutWrapper) blackoutWrapper.style.display = 'block';

            let today = new Date();
            let currentYear = today.getFullYear();
            let inputYear = parseInt(dateMatch[3], 10);
            let inputDate = new Date(dateMatch[3], parseInt(dateMatch[2]) - 1, dateMatch[1]);

            if (btnDvrEl) {
                btnDvrEl.style.display = 'inline-block';
                if (inputYear !== currentYear) {
                    btnDvrEl.disabled = true; btnDvrEl.style.backgroundColor = '#7f8c8d'; btnDvrEl.style.cursor = 'not-allowed';
                    btnDvrEl.innerHTML = `🚫 Дію заблоковано. Зазначено не ${currentYear} рік. Треба виправити.`;
                } else {
                    btnDvrEl.disabled = false; btnDvrEl.style.backgroundColor = '#8e44ad'; btnDvrEl.style.cursor = 'pointer';
                    btnDvrEl.innerHTML = '⏱️ Встановити DVR (-10г | +10г)';
                }
            }
            if (inputDate.toDateString() !== today.toDateString()) {
                warningDiv.innerHTML = `⚠️ Увага: Дата в назві (${dateMatch[0]}) не збігається з сьогоднішньою!`;
                warningDiv.style.display = 'block';
            } else {
                warningDiv.style.display = 'none';
            }
        } else {
            if (btnAudioEl) btnAudioEl.style.display = 'none';
            if (btnDvrEl) btnDvrEl.style.display = 'none';
            if (blackoutWrapper) blackoutWrapper.style.display = 'none';
            warningDiv.style.display = 'none';
        }
    }

    // =====================================================================================
    // 🟩 ЛОГІКА 2: СТОРІНКА ТЕЛЕКАНАЛУ (Масові блекаути, Динамічні часові пояси, AI Ready)
    // =====================================================================================
    let channelBlackoutUrl = null;
    let channelDetectedName = "Невідомий канал";
    let channelCurrentOffset = 0;

    function detectChannelContext() {
        for (let el of document.querySelectorAll('.controls.ng-binding')) {
            const text = el.innerText.trim();
            if (CHANNEL_MAP[text]) {
                channelBlackoutUrl = CHANNEL_MAP[text].url;
                channelDetectedName = CHANNEL_MAP[text].name;
                channelCurrentOffset = CHANNEL_MAP[text].offset;
                return true;
            }
        }
        return false;
    }

    function renderChannelUI() {
        let panel = document.getElementById('mgg-channel-ai-panel');
        const channelStatusHtml = `📺 Канал: <b>${channelDetectedName}</b><br><span style="color:#bdc3c7; font-size: 11px;">🕒 Часовий пояс: UTC+${channelCurrentOffset}</span>`;

        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'mgg-channel-ai-panel';
            panel.style.cssText = `position:fixed; bottom:20px; right:20px; padding:15px; background:#2c3e50; color:#fff; border-radius:8px; z-index:9999; box-shadow:0 4px 6px rgba(0,0,0,0.3); min-width:240px; font-family:sans-serif;`;

            panel.innerHTML = `
            <h4 style="margin:0 0 10px 0; color:#18bc9c;">🤖 Smart Channel Blackouts</h4>
            <div id="mgg-channel-status" style="margin-bottom:10px; font-size:13px; color:#f1c40f;">
            ${channelStatusHtml}
            </div>

            <button id="fetchAiBtn" style="padding:10px 12px; margin-bottom:10px; background:#8e44ad; border:none; color:white; cursor:pointer; border-radius:4px; font-weight:bold; width:100%; transition: 0.2s;">
            ✨ Отримати з пошти (через AI)
            </button>

            <input type="file" id="csvFileInput" accept=".csv" style="display:none;">
            <button id="uploadCsvBtn" style="padding:8px 12px; margin-bottom:10px; background:#18bc9c; border:none; color:white; cursor:pointer; border-radius:4px; font-weight:bold; width:100%;">
            📥 Завантажити CSV вручну
            </button>

            <button id="clearOldBtn" style="padding:8px 12px; background:#e74c3c; border:none; color:white; cursor:pointer; border-radius:4px; font-weight:bold; width:100%;">
            🗑 Видалити старі
            </button>

            <div id="channelScriptStatus" style="margin-top:10px; font-size:12px; color:#bdc3c7;">Очікування команд...</div>
            `;
            document.body.appendChild(panel);

            document.getElementById('clearOldBtn').onclick = clearOldSchedules;
            document.getElementById('uploadCsvBtn').onclick = () => document.getElementById('csvFileInput').click();
            document.getElementById('csvFileInput').onchange = handleFile;

            document.getElementById('fetchAiBtn').onclick = async () => {
                const statusEl = document.getElementById('channelScriptStatus');
                statusEl.innerText = "⏳ Звертаюсь до AI...";
                statusEl.style.color = '#f39c12';

                try {
                    const WEB_APP_URL = ''; //WEB_APP URL (Google AI Studio) + статичний токен для захисту

                    const response = await fetch(WEB_APP_URL);
                    const aiData = await response.json(); // Отримуємо весь мультиканальний JSON

                    // Гнучкий пошук потрібного масиву за назвою каналу
                    // Наприклад: channelDetectedName = "TVP Sport", а в JSON ключ "TVP Sport HD"
                    const targetKey = Object.keys(aiData).find(key =>
                    key.includes(channelDetectedName) || channelDetectedName.includes(key)
                    );

                    if (!targetKey || !aiData[targetKey] || aiData[targetKey].length === 0) {
                        statusEl.innerText = `❌ В AI-відповіді немає даних для ${channelDetectedName}`;
                        statusEl.style.color = '#e74c3c';
                        return;
                    }

                    // Перетворюємо AI-рядки у валідні Date об'єкти
                    let rawSchedules = aiData[targetKey];
                    let schedules = [];
                    for (let item of rawSchedules) {
                        let startDate = createFakeUTCDate(item.start);
                        let finishDate = createFakeUTCDate(item.finish);

                        if (finishDate.getTime() < startDate.getTime()) {
                            finishDate.setDate(finishDate.getDate() + 1); // Перехід через північ
                        }
                        schedules.push({ start: startDate, finish: finishDate });
                    }

                    // Зклеюємо інтервали
                    let originalCount = schedules.length;
                    schedules = mergeSchedules(schedules);
                    let mergeInfo = originalCount !== schedules.length ? ` (Склеєно ${originalCount - schedules.length})` : "";

                    statusEl.style.color = '#f39c12';
                    statusEl.innerText = `🚀 Встановлюю ${schedules.length} подій${mergeInfo}...`;

                    // Запускаємо емуляцію кліків
                    await processSchedules(schedules);

                    statusEl.style.color = '#2ecc71';
                    statusEl.innerText = `✅ Додано ${schedules.length} блекаутів! Тисніть 'Зберегти'.`;
                } catch (error) {
                    console.error(error);
                    statusEl.innerText = "❌ Помилка зв'язку з AI API";
                    statusEl.style.color = '#e74c3c';
                }
            };
        } else {
            // Оновлюємо текст, якщо юзер перейшов на інший канал в межах SPA
            const statusDiv = document.getElementById('mgg-channel-status');
            if (statusDiv) statusDiv.innerHTML = channelStatusHtml;
        }

        panel.style.display = 'block'; // Примусово показуємо панель
    }

    async function clearOldSchedules() {
        const statusEl = document.getElementById('channelScriptStatus');
        const btnClear = document.getElementById('clearOldBtn');
        const removeIcons = document.querySelectorAll('.icon-remove-sign.clickable');

        if (removeIcons.length <= 1) {
            statusEl.style.color = '#f1c40f'; statusEl.innerText = "ℹ️ Немає додаткових блекаутів для видалення."; return;
        }

        statusEl.style.color = '#e74c3c'; statusEl.innerText = `🗑 Видаляю ${removeIcons.length - 1} блоків...`;
        btnClear.disabled = true; btnClear.style.opacity = '0.5';

        for (let i = removeIcons.length - 1; i >= 1; i--) {
            removeIcons[i].click();
            await new Promise(r => setTimeout(r, 400));
            const confirmBtn = document.querySelector('button.btn.btn-primary[ng-click="ok()"]');
            if (confirmBtn) confirmBtn.click();
            await new Promise(r => setTimeout(r, 600));
        }

        statusEl.style.color = '#2ecc71'; statusEl.innerText = "✅ Очищення завершено. Збережіть сторінку!";
        btnClear.disabled = false; btnClear.style.opacity = '1';
    }

    function handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const statusEl = document.getElementById('channelScriptStatus');
            let schedules = parseStructuredCSV(e.target.result);
            if (!schedules || schedules.length === 0) {
                statusEl.style.color = '#e74c3c'; statusEl.innerText = "❌ Блекаутів не знайдено."; return;
            }
            let originalCount = schedules.length;
            schedules = mergeSchedules(schedules);
            let mergeInfo = originalCount !== schedules.length ? ` (Склеєно ${originalCount - schedules.length} накладень)` : "";

            statusEl.style.color = '#f39c12'; statusEl.innerText = `🚀 Завантажую ${schedules.length} подій${mergeInfo}...`;
            await processSchedules(schedules);

            statusEl.style.color = '#2ecc71'; statusEl.innerText = `✅ Додано ${schedules.length} блекаутів! Тисніть 'Зберегти'.`;
            document.getElementById('csvFileInput').value = '';
        };
        reader.readAsText(file);
    }

    function parseStructuredCSV(csvText) {
        const lines = csvText.split('\n');
        const schedules = [];
        for (let i = 1; i < lines.length; i++) {
            let cleanLine = lines[i].trim();
            if (!cleanLine) continue;
            const parts = cleanLine.split(/[,;]/);
            if (parts.length >= 2) {
                let startStr = parts[0].replace(/['"]/g, '').trim();
                let finishStr = parts[1].replace(/['"]/g, '').trim();
                if (startStr && finishStr) {
                    let startDate = createFakeUTCDate(startStr);
                    let finishDate = createFakeUTCDate(finishStr);
                    if (finishDate.getTime() < startDate.getTime()) {
                        finishDate.setDate(finishDate.getDate() + 1);
                    }
                    schedules.push({ start: startDate, finish: finishDate });
                }
            }
        }
        return schedules;
    }

    function mergeSchedules(schedules) {
        if (schedules.length === 0) return [];
        schedules.sort((a, b) => a.start.getTime() - b.start.getTime());
        const merged = [schedules[0]];
        for (let i = 1; i < schedules.length; i++) {
            const current = schedules[i];
            const lastMerged = merged[merged.length - 1];
            if (current.start.getTime() <= lastMerged.finish.getTime()) {
                if (current.finish.getTime() > lastMerged.finish.getTime()) lastMerged.finish = current.finish;
            } else {
                merged.push(current);
            }
        }
        return merged;
    }

    function createFakeUTCDate(dateStr) {
        const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/);
        if (!match) return new Date();
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const day = parseInt(match[3]);
        const hours = parseInt(match[4]);
        const minutes = parseInt(match[5]);
        const seconds = match[6] ? parseInt(match[6]) : 0;

        const realUTC = new Date(Date.UTC(year, month, day, hours - channelCurrentOffset, minutes, seconds));
        return new Date(realUTC.getUTCFullYear(), realUTC.getUTCMonth(), realUTC.getUTCDate(), realUTC.getUTCHours(), realUTC.getUTCMinutes(), realUTC.getUTCSeconds());
    }

    async function processSchedules(schedules) {
        for (let sched of schedules) {
            const addButton = document.querySelector('button[data-ng-click="new_schedule()"]');
            if (addButton) addButton.click();
            await sleep(300);
            const scheduleBlocks = document.querySelectorAll('section[data-ng-repeat="schedule in event.event.schedules"]');
            const newBlock = scheduleBlocks[scheduleBlocks.length - 1];
            if (newBlock) {
                const scope = angular.element(newBlock).scope();
                if (scope && scope.schedule) {
                    scope.schedule.start = sched.start;
                    scope.schedule.finish = sched.finish;
                    scope.schedule.url = channelBlackoutUrl;
                    scope.$apply();
                }
            }
            await sleep(100);
        }
    }

    // =====================================================================================
    // 🔀 ГОЛОВНИЙ МАРШРУТИЗАТОР (Router)
    // =====================================================================================
    setInterval(() => {
        const isChannel = detectChannelContext();
        const eventTitleInput = document.querySelector('#fld-name');

        if (isChannel) {
            // 1. Якщо знайдено CDN ID телеканалу — це ПРІОРИТЕТ.
            // Ховаємо інтерфейс звичайних подій, якщо він був створений
            const eventWrapper = document.querySelector('#qa-blackout-wrapper');
            if (eventWrapper) eventWrapper.style.display = 'none';
            const audioBtn = document.querySelector('#qa-audio-btn');
            if (audioBtn) audioBtn.style.display = 'none';
            const dvrBtn = document.querySelector('#qa-dvr-btn');
            if (dvrBtn) dvrBtn.style.display = 'none';

            renderChannelUI();

        } else if (eventTitleInput) {
            // 2. Якщо CDN ID телеканалу немає, але є поле назви — це ПОДІЯ.
            // Ховаємо інтерфейс телеканалу
            const channelPanel = document.getElementById('mgg-channel-ai-panel');
            if (channelPanel) channelPanel.style.display = 'none';

            handleEventPageLogic(eventTitleInput);
        }
    }, 1000);

})();
