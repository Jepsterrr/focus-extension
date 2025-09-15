const IGNORED_DOMAINS = [
    'google.com',
    'bing.com',
    'duckduckgo.com',
    'yahoo.com',
    'baidu.com',
    'yandex.ru',
    'chatgpt.com',
    'chrome://',
    'edge://',
];
let offscreenDocumentPath = 'offscreen.html';

async function hasOffscreenDocument(path: string): Promise<boolean> {
    const offscreenUrl = chrome.runtime.getURL(path);
    const matchedClients = await (self as unknown as ServiceWorkerGlobalScope).clients.matchAll(); 
    return matchedClients.some((client: Client) => client.url === offscreenUrl); 
}

async function setupOffscreenDocument(path: string) {
    if (!(await hasOffscreenDocument(path))) {
        await chrome.offscreen.createDocument({
            url: path,
            reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
            justification: 'Nödvändig för att köra AI-modeller i bakgrunden.',
        });
    }
}

// Ladda modellerna vid installation/start genom att starta offscreen-dokumentet
chrome.runtime.onInstalled.addListener(() => setupOffscreenDocument(offscreenDocumentPath));
chrome.runtime.onStartup.addListener(() => setupOffscreenDocument(offscreenDocumentPath));

// Lyssnar på när en flik uppdateras
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        const url = new URL(tab.url);
        if (IGNORED_DOMAINS.some(domain => url.hostname.includes(domain))) {
            return;
        }

        const { activeTask, focusStartTime, snoozeUntil, whitelist = [], sensitivity = 'balanced' } = await chrome.storage.local.get(['activeTask', 'focusStartTime', 'snoozeUntil', 'whitelist', 'sensitivity']);
        
        // Avbryt om ingen aktiv uppgift, vi snoozar, eller domänen är vitlistad
        if (!activeTask || !focusStartTime) return;
        if (snoozeUntil && Date.now() < snoozeUntil) {
            console.log("Snooze aktiv, ignorerar analys.");
            return;
        }
        if (whitelist.includes(url.hostname)) {
            console.log(`Domänen ${url.hostname} är vitlistad, ignorerar analys.`);
            return;
        }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: extractPageContent,
            });

            const pageData = results[0]?.result;
            if (!pageData || !pageData.mainText || pageData.mainText.trim().length < 50) {
                console.log("Sidan har för lite innehåll för att analyseras.");
                return;
            }

            // Starta offscreen-dokumentet och skicka jobbet
            await setupOffscreenDocument(offscreenDocumentPath);
            const response = await chrome.runtime.sendMessage({
                type: 'ANALYZE_PAGE',
                payload: {
                    task: activeTask,
                    pageData,
                    sensitivity
                }
            });

            if (!response.isRelevant) {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });
            }
        } catch (e) {
            console.error("Fel vid sidanalys:", e);
        }
    }
});

chrome.runtime.onMessage.addListener(async (message, _sender, _sendResponse) => {
    if (message.type === 'WHITELIST_DOMAIN') {
        const { whitelist = [] } = await chrome.storage.local.get('whitelist');
        const newWhitelist = [...new Set([...whitelist, message.payload.domain])];
        await chrome.storage.local.set({ whitelist: newWhitelist });
        console.log(`Domänen ${message.payload.domain} har lagts till i vitlistan.`);
    } else if (message.type === 'SNOOZE') {
        const snoozeUntil = Date.now() + message.payload.durationMinutes * 60 * 1000;
        await chrome.storage.local.set({ snoozeUntil });
        console.log(`Analys pausad i ${message.payload.durationMinutes} minuter.`);
    } else if (message.type === 'STOP_FOCUS') {
        const tabs = await chrome.tabs.query({});

        for (const tab of tabs) {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'CLOSE_OVERLAY' }).catch(_error => {
                    // Ignorera fel som uppstår om innehållsskriptet inte är injicerat
                });
            }
        }
    }
});

function extractPageContent() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    let title = document.title || '';
    let mainText = '';

    // Strategi 1: YouTube
    if (hostname.includes('youtube.com') && url.includes('/watch')) {
        const videoTitle = document.querySelector('h1.style-scope.ytd-watch-metadata')?.textContent || '';
        const description = document.querySelector('#description-inline-expander')?.textContent || '';
        const channel = document.querySelector('#channel-name')?.textContent || '';
        title = videoTitle || title;
        mainText = `${videoTitle}\n${channel}\n${description}`;

    // Strategi 2: PDF-filer
    } else if (url.toLowerCase().endsWith('.pdf')) {
        // Textinnehåll är svårt att få från PDF:er. Titeln är vår bästa ledtråd.
        mainText = title;

    // Strategi 3: Stack Overflow (och liknande forum)
    } else if (hostname.includes('stackoverflow.com')) {
        const questionTitle = document.querySelector('#question-header h1')?.textContent || '';
        const acceptedAnswer = document.querySelector('.accepted-answer .s-prose')?.textContent || '';
        title = questionTitle || title;
        mainText = `${questionTitle}\n${acceptedAnswer}`;

    // Strategi 4: Standard (Artiklar, Wikipedia, etc.)
    } else {
        const h1 = (document.querySelector('h1')?.innerText || '');
        const metaDescription = (document.querySelector('meta[name="description"]')?.getAttribute('content') || '');
        const mainContent = (document.querySelector('main')?.innerText || 
                             document.querySelector('article')?.innerText || 
                             document.body.innerText);
        mainText = `${title}\n${h1}\n${metaDescription}\n${mainContent}`;
    }

    // Returnera ett standardiserat objekt
    return {
        title: title,
        mainText: mainText.substring(0, 5000)
    };
}

