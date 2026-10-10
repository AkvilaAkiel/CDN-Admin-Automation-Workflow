// =========================================================================
// AI Parser (Blackouts EXCEL)
// =========================================================================

const API_KEY = '';
const SHEET_NAME = '';
const SPREADSHEET_ID = '';
// Тепер шукаємо листи з вкладеннями
const GMAIL_QUERY = 'subject:"розклад" has:attachment is:unread';

// -------------------------------------------------------------------------
// ЧАСТИНА 1: ПАРСЕР З ВИТЯГУВАННЯМ EXCEL
// -------------------------------------------------------------------------
function processBlackoutEmails() {
    const threads = GmailApp.search(GMAIL_QUERY, 0, 1);
    if (threads.length === 0) {
        Logger.log("Нових листів з розкладами не знайдено.");
        return;
    }

    const messages = threads[0].getMessages();
    const latestMessage = messages[messages.length - 1];
    const attachments = latestMessage.getAttachments();

    if (attachments.length === 0) {
        Logger.log("У листі немає вкладень.");
        return;
    }

    let combinedData = "";

    // Проходимось по всіх вкладеннях
    for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const fileName = attachment.getName();

        // Якщо це Excel або CSV
        if (fileName.includes('.xls') || fileName.includes('.csv')) {
            Logger.log(`Оброблюємо файл: ${fileName}`);
            const fileText = extractTextFromExcel(attachment);
            if (fileText) {
                // Збираємо текст усіх файлів в один великий промпт, відділяючи іменами файлів
                combinedData += `\n--- ФАЙЛ: ${fileName} ---\n${fileText}\n`;
            }
        }
    }

    if (!combinedData) {
        Logger.log("Не вдалося витягнути дані з вкладень.");
        return;
    }

    Logger.log("Відправляємо зібрані дані в Gemini...");
    const jsonResult = parseWithGemini(combinedData);

    if (jsonResult) {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        let sheet = ss.getSheetByName(SHEET_NAME);
        if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

        sheet.getRange('A1:C1').setValues([['Час отримання', 'Відправник', 'JSON Дані (Мультиканальний)']]).setFontWeight('bold');
        sheet.getRange('A2:C2').setValues([[new Date(), latestMessage.getFrom(), jsonResult]]);
        sheet.autoResizeColumns(1, 3);

        threads[0].markRead();
        Logger.log("Успішно оброблено та збережено в БД.");
    }
}

// Функція конвертації Excel -> Текст через Drive API
function extractTextFromExcel(attachment) {
    try {
        // Створюємо тимчасовий Google Sheet з Excel-файлу
        const metadata = {
            name: attachment.getName(),
            mimeType: MimeType.GOOGLE_SHEETS
        };
        const tempFile = Drive.Files.create(metadata, attachment);

        // Читаємо дані
        const ss = SpreadsheetApp.openById(tempFile.id);
        const sheet = ss.getSheets()[0];
        const data = sheet.getDataRange().getValues();

        // Перетворюємо масив у текст
        const textContent = data.map(row => row.join(';')).join('\n');

        // Видаляємо тимчасовий файл (щоб не смітити на Диску)
        DriveApp.getFileById(tempFile.id).setTrashed(true);

        return textContent;
    } catch (e) {
        Logger.log("Помилка конвертації файлу: " + e.message);
        return null;
    }
}

// -------------------------------------------------------------------------
// ЧАСТИНА 2: ЗВ'ЯЗОК З GEMINI API (Retry)
// -------------------------------------------------------------------------
function parseWithGemini(text) {
    // Використовуємо стабільну 3.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;

    const prompt = `
    Ти - суворий серверний парсер даних. Твоя задача витягнути з наведеного тексту розклад блекаутів для кількох телеканалів.
    Дані передаються з кількох файлів. Назва файлу вказує на назву телеканалу (наприклад, TVP Info, TVP Sport HD, TVP Rozrywka, TVP Seriale).

    Тобі потрібно повернути РІВНО ОДИН JSON-об'єкт.
    Ключами цього об'єкта мають бути назви каналів (витягни їх з імен файлів, очистивши від зайвих слів типу Blackout чи дат).
    Значеннями мають бути масиви об'єктів з ключами "start" та "finish".
    Час бери як є, у форматі: "YYYY-MM-DD HH:mm".

    Без привітань, без пояснень, без форматування markdown. Тільки чистий JSON.

    Вхідні дані:
    ${text}
    `;

    const payload = {
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json"
        }
    };

    const options = {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
    };

    // Робимо 3 спроби достукатися до сервера
    const maxRetries = 3;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = UrlFetchApp.fetch(url, options);
            const jsonText = response.getContentText();
            const data = JSON.parse(jsonText);

            // Перевіряємо, чи повернув Google помилку
            if (data.error) {
                if (data.error.code === 503 || data.error.code === 429) {
                    Logger.log(`⚠️ Сервер перевантажений (Спроба ${i + 1}/${maxRetries}). Чекаємо 3 секунди...`);
                    Utilities.sleep(3000); // Чекаємо 3 секунди перед наступною спробою
                    continue;
                }
                Logger.log("❌ Помилка від Gemini API: " + jsonText);
                return null;
            }

            // Якщо все успішно
            if (data.candidates && data.candidates.length > 0) {
                return data.candidates[0].content.parts[0].text;
            }

        } catch (e) {
            Logger.log(`❌ Системна помилка (Спроба ${i + 1}/${maxRetries}): ` + e.message);
            Utilities.sleep(3000);
        }
    }

    Logger.log("❌ Не вдалося отримати відповідь від AI після 3 спроб.");
    return null;
}

function checkAvailableModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});

    const data = JSON.parse(response.getContentText());

    if (data.models && data.models.length > 0) {
        Logger.log("✅ Усі доступні моделі (без фільтрів):");
        data.models.forEach(model => {
            Logger.log(model.name);
        });
    } else if (data.models && data.models.length === 0) {
        Logger.log("⚠️ Список моделей абсолютно порожній. API увімкнено, але доступу до моделей немає.");
    } else {
        Logger.log("❌ Відповідь API: " + response.getContentText());
    }
}
