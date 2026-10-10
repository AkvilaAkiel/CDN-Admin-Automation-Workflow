# CDN Admin Automation Workflow ⚙️🤖

> **Note:** *This is a sanitized version of an internal Tampermonkey userscript and Google Apps Script created for portfolio showcase. API endpoints, proprietary URLs, and access tokens have been redacted to comply with NDA.*

## 📌 Overview
Managing thousands of live events and OTT channels via standard web admin panels often involves repetitive, click-heavy, and error-prone manual tasks. 
        
**The Problem:** Operations teams spent excessive time configuring DVR windows, assigning standardized audio tracks, and applying complex, multi-interval blackout schedules for broadcasting rights (e.g., geoblocking foreign channels during specific sports events). Manually calculating overlapping rights from Excel sheets sent via email was a massive bottleneck.

**The Solution:** A two-part automation ecosystem:
1. **Google Apps Script (Backend):** Automatically intercepts emails with blackout schedules, extracts Excel attachments, and feeds them into **Google AI Studio (Gemini API)** to generate standardized JSON arrays.
2. **Tampermonkey Userscript (Frontend):** Injects custom UI components into the corporate CDN admin panel, automates repetitive configurations (DVR, Audio), and fetches the AI-parsed JSON to autonomously apply complex blackout rules via DOM manipulation.

## 🚀 Business Impact
* **Zero-Touch Data Entry:** Eliminated manual calculation and entry of blackout schedules, removing human error and preventing potential broadcasting rights violations.
* **Operational Speed:** Reduced the time required to configure a live event from minutes to seconds via 1-click macro buttons.
* **Intelligent Workflows:** Integrated "fool-proof" mechanisms (e.g., warning operators if the event year is incorrect) to enforce standardized configurations.

## ✨ Key Features
### Frontend (JavaScript / Tampermonkey)
* **🎬 Smart Channel Blackouts:** Connects to the GAS endpoint to fetch multi-interval blackout schedules, mathematically merges overlapping timeframes (preventing system conflicts), and automatically simulates clicks to inject them into the DOM.
* **⏱ 1-Click Event Setup:** Automatically calculates timezone offsets and sets DVR bounds (-10h / +10h), while injecting standardized audio tracks (Native, Alternate, International) with proper PID mapping.
* **💡 Context-Aware Routing:** A background router monitors the DOM to detect whether the user is on an "Event" or a "Channel" page, rendering only the appropriate automation tools.
* **🖼 Automated Thumbnail Previews:** Dynamically renders image thumbnails for inserted technical URLs to provide visual confirmation to operators without leaving the page.

### Backend (Google Apps Script / Gemini API)
* **📧 Automated Inbox Parsing:** Scans a specific Gmail query for unread emails containing Excel/CSV blackout schedules.
* **🤖 AI Parsing Engine:** Uses the `gemini-3.5-flash` model to act as a strict server-side parser. It extracts complex schedule matrices from Excel text dumps and normalizes them into pure JSON.
* **🛡 Resilient Architecture:** Implements a robust 3-attempt retry logic to handle potential AI API rate limits or 503 errors before saving the normalized JSON to a buffer database.

## 🛠 Tech Stack
* **Languages:** JavaScript (ES6+), Google Apps Script (GAS)
* **Frontend:** Tampermonkey / Greasemonkey (DOM Manipulation, Event Delegation, Fetch API)
* **Backend Integration:** Gmail API, Google Drive API, Google AI Studio (Gemini 3.5 Flash)

## 📋 Architecture Flow
1. **Trigger:** Polish broadcasting partners send weekly Excel schedules to a designated email.
2. **Backend (GAS):** A time-driven trigger extracts the Excel file, converts it to raw text, and sends it to the Gemini API with a strict zero-temperature prompt.
3. **Buffer:** Gemini returns a normalized JSON object which is cached in a Google Sheet.
4. **Frontend (Userscript):** An operator clicks "✨ Fetch via AI" inside the CDN admin panel. The script queries the GAS endpoint, retrieves the JSON, merges any overlapping timestamps, and dynamically creates the necessary blackout blocks in the web interface.
