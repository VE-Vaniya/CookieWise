// js/dashboard-updater.js
const scores = {};

const FALLBACK_PRIVACY = {
    summary: "This website collects personal data for analytics and advertising. It shares data with third-party partners and uses cookies for tracking.",
    dataCollected: ["Email address", "IP address", "Browsing history", "Device information", "Location data"],
    thirdParties: ["Advertising networks", "Analytics providers", "Social media platforms", "Marketing partners"],
    retentionPeriod: "Until account deletion or 2 years after last activity",
    userControls: ["Access your data", "Request deletion", "Opt-out of marketing", "Cookie preferences"],
    riskScore: 65,
    warnings: ["Uses cookies for targeted advertising", "Shares data with third parties", "May transfer data internationally"]
};

const FALLBACK_TERMS = {
    summary: "This website's terms include standard liability limitations, dispute resolution through arbitration, and account termination rights.",
    dataCollected: ["Account information", "Payment details", "Usage data", "Communications"],
    thirdParties: ["Payment processors", "Customer service platforms", "Analytics tools"],
    retentionPeriod: "As long as account is active + 30 days",
    userControls: ["Delete account", "Export data", "Close subscription"],
    riskScore: 45,
    warnings: ["Mandatory arbitration clause", "No refund policy", "Can terminate without notice"]
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 CookieWise Dashboard Initializing...');
    showLoadingState();

    try {
        const { extractedPrivacy, extractedTerms } = await getExtractedTexts();

        if (!extractedPrivacy && !extractedTerms) {
            showNoDataState();
            return;
        }

        const summarizer = new PolicySummarizer();
        console.log('📄 Analyzing policies with single API call...');
        const combined = await summarizer.summarizeBoth(extractedPrivacy, extractedTerms);

        console.log('📦 Groq combined result:', combined);

        const privacy = (combined.privacy && combined.privacy.dataCollected) ? combined.privacy : FALLBACK_PRIVACY;
        const terms = (combined.terms && combined.terms.thirdParties) ? combined.terms : FALLBACK_TERMS;

        scores.privacy = privacy.riskScore;
        scores.terms = terms.riskScore;

        // Card 0 — TRACKING TECHNOLOGIES → what trackers/data types are used (privacy.thirdParties)
        updateTrackingCard(privacy);

        // Card 1 — DATA SHARING → who data is shared with (privacy.thirdParties)
        updateSharingCard(privacy);

        // Card 2 — DATA COLLECTION → what data is collected (privacy.dataCollected)
        updateCollectionCard(privacy);

        updateOverallRisk(scores);

    } catch (error) {
        console.error('❌ Dashboard error:', error);
        showErrorState(error.message);
    }
});

// /** Card 0 — TRACKING TECHNOLOGIES */
// function updateTrackingCard(summary) {
//     if (!summary) return;

//     // Show third parties as trackers (Google Analytics, Facebook Pixel, etc.)
//     const items = summary.thirdParties || summary.dataCollected || [];
//     const cardBack = document.querySelectorAll('.flip-card-back')[0];
//     if (cardBack) {
//         const list = cardBack.querySelector('ul');
//         if (list) {
//             list.innerHTML = items.map(i => `<li style="margin:0.5rem 0;">• ${i}</li>`).join('');
//         }
//     }
//     const countEl = document.getElementById('dataPointsCount');
//     if (countEl) countEl.textContent = items.length;
// }
function updateTrackingCard(summary) {
    if (!summary) return;

    // ✅ Use trackingTechnologies — NOT thirdParties
    const items = cleanDataItems(summary.trackingTechnologies?.length
        ? summary.trackingTechnologies
        : ["Cookies", "Analytics trackers", "Advertising pixels"]);

    const cardBack = document.querySelectorAll('.flip-card-back')[0];
    if (cardBack) {
        const list = cardBack.querySelector('ul');
        if (list) {
            list.innerHTML = items.map(i => `<li style="margin:0.5rem 0;">• ${i}</li>`).join('');
        }
    }
    const countEl = document.getElementById('dataPointsCount');
    if (countEl) countEl.textContent = items.length;
}

// /** Card 1 — DATA SHARING */
// function updateSharingCard(summary) {
//     if (!summary) return;

//     // Use thirdParties from privacy — terms rarely has a meaningful list here
//     const items = (summary.thirdParties && summary.thirdParties.length > 0)
//         ? summary.thirdParties
//         : FALLBACK_PRIVACY.thirdParties;

//     const cardBack = document.querySelectorAll('.flip-card-back')[1];
//     if (cardBack) {
//         const list = cardBack.querySelector('ul');
//         if (list) {
//             list.innerHTML = items.map(i => `<li style="margin:0.5rem 0;">• ${i}</li>`).join('');
//         }
//     }
//     const countEl = document.getElementById('partnersCount');
//     if (countEl) countEl.textContent = items.length + '+';
// }
function updateSharingCard(summary) {
    if (!summary) return;

    // Filter out any items that look like people's names (contain honorifics)
    const namePatterns = /\b(mr|ms|mrs|dr|prof|monsieur|madame)\b/i;
    let items = cleanDataItems((summary.thirdParties || []).filter(i => !namePatterns.test(i)));

    // Fall back if nothing useful came back
    if (items.length === 0) {
        items = FALLBACK_PRIVACY.thirdParties;
    }

    const cardBack = document.querySelectorAll('.flip-card-back')[1];
    if (cardBack) {
        const list = cardBack.querySelector('ul');
        if (list) {
            list.innerHTML = items.map(i => `<li style="margin:0.5rem 0;">• ${i}</li>`).join('');
        }
    }
    const countEl = document.getElementById('partnersCount');
    if (countEl) countEl.textContent = items.length + '+';
}
/** Card 2 — DATA COLLECTION */
// function updateCollectionCard(summary) {
//     if (!summary) return;

//     const items = (summary.dataCollected && summary.dataCollected.length > 0)
//         ? summary.dataCollected
//         : FALLBACK_PRIVACY.dataCollected;

//     const cardBack = document.querySelectorAll('.flip-card-back')[2];
//     if (cardBack) {
//         const list = cardBack.querySelector('ul');
//         if (list) {
//             list.innerHTML = items.map(i => `<li style="margin:0.5rem 0;">• ${i}</li>`).join('');
//         }
//     }
//     const countEl = document.getElementById('dataCollectionCount');
//     if (countEl) countEl.textContent = items.length;
// }
function updateCollectionCard(summary) {
    if (!summary) return;

    const raw = (summary.dataCollected && summary.dataCollected.length > 0)
        ? summary.dataCollected
        : FALLBACK_PRIVACY.dataCollected;

    const items = cleanDataItems(raw); // ← run through cleaner

    const cardBack = document.querySelectorAll('.flip-card-back')[2];
    if (cardBack) {
        const list = cardBack.querySelector('ul');
        if (list) {
            list.innerHTML = items.map(i => `<li style="margin:0.5rem 0;">• ${i}</li>`).join('');
        }
    }
    const countEl = document.getElementById('dataCollectionCount');
    if (countEl) countEl.textContent = items.length;
}

// Keep old names as aliases so nothing else breaks
function updatePrivacySection(summary) { updateTrackingCard(summary); updateCollectionCard(summary); }
function updateTermsSection(summary) { updateSharingCard(summary); }

async function getExtractedTexts() {
    const MAX_ATTEMPTS = 10;
    const DELAY_MS = 1500;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const result = await new Promise(resolve =>
            chrome.storage.local.get(['extractedPrivacy', 'extractedTerms'], resolve)
        );
        if (result.extractedPrivacy || result.extractedTerms) {
            console.log(`✅ Data found on attempt ${i + 1}`);
            return { extractedPrivacy: result.extractedPrivacy || null, extractedTerms: result.extractedTerms || null };
        }
        console.log(`⏳ Attempt ${i + 1}/${MAX_ATTEMPTS} — waiting for storage...`);
        await new Promise(r => setTimeout(r, DELAY_MS));
    }
    return { extractedPrivacy: null, extractedTerms: null };
}

function updateOverallRisk(scores) {
    const vals = Object.values(scores).filter(v => v !== undefined && v !== null);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 50;

    const riskEl = document.getElementById('riskScore');
    const gaugeEl = document.getElementById('gaugeFill');
    if (riskEl) riskEl.textContent = avg + '%';
    if (gaugeEl) {
        gaugeEl.style.width = avg + '%';
        const color = avg <= 30 ? '#00ff00' : avg <= 60 ? '#ffff00' : '#ff0000';
        gaugeEl.style.background = `linear-gradient(90deg, ${color}, #f0f)`;
    }
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.remove();
    console.log(`🎯 Overall risk score: ${avg}%`);
}
// Add this helper function near the top of the file:
function cleanDataItems(items) {
    if (!items || !Array.isArray(items)) return [];

    const result = [];
    for (const item of items) {
        // If a single item contains semicolons or is very long, split it up
        if (item.includes(';') || item.length > 60) {
            const parts = item
                .split(/[;,]/)                          // split on semicolons or commas
                .map(s => s.trim())                     // trim whitespace
                .filter(s => s.length > 0 && s.length < 80) // remove empty or huge strings
                .map(s => s.replace(/^(and|or|the)\s+/i, '')) // remove leading "and/or/the"
                .map(s => s.charAt(0).toUpperCase() + s.slice(1)); // capitalize
            result.push(...parts);
        } else {
            result.push(item.trim());
        }
    }
    // Deduplicate and limit to 12 items max for readability
    return [...new Set(result)].slice(0, 12);
}

function showLoadingState() {
    const riskScore = document.getElementById('riskScore');
    if (riskScore) riskScore.textContent = '...';
    const container = document.querySelector('.risk-card-3d');
    if (container && !document.getElementById('loading-indicator')) {
        const div = document.createElement('div');
        div.id = 'loading-indicator';
        div.style.cssText = 'text-align:center;padding:20px;color:cyan;font-size:1.2rem;';
        div.innerHTML = '🔄 Analyzing policies with Groq AI...';
        container.appendChild(div);
    }
}

function showNoDataState() {
    const riskScore = document.getElementById('riskScore');
    if (riskScore) riskScore.textContent = 'N/A';
    const gaugeFill = document.getElementById('gaugeFill');
    if (gaugeFill) gaugeFill.style.width = '0%';
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.remove();
    const container = document.querySelector('.category-grid-interactive');
    if (container && !document.querySelector('.no-data-message')) {
        const div = document.createElement('div');
        div.className = 'no-data-message';
        div.style.cssText = 'grid-column:1/-1;text-align:center;padding:50px;background:rgba(0,255,255,0.1);border-radius:20px;border:1px solid cyan;';
        div.innerHTML = '<h3 style="color:cyan;">🔍 No Policy Detected</h3><p style="color:#94a3b8;margin-top:10px;">Visit a website with a cookie banner to see analysis.</p>';
        container.prepend(div);
    }
}

function showErrorState(error) {
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.remove();
    const container = document.querySelector('.category-grid-interactive');
    if (container && !document.querySelector('.error-message')) {
        const div = document.createElement('div');
        div.className = 'error-message';
        div.style.cssText = 'grid-column:1/-1;text-align:center;padding:30px;background:rgba(255,0,0,0.1);border-radius:20px;border:1px solid #ff6b6b;margin-bottom:20px;';
        div.innerHTML = `<h3 style="color:#ff6b6b;">⚠️ Analysis Error</h3><p style="color:#94a3b8;margin-top:10px;">${error}</p>`;
        container.prepend(div);
    }
}

// UI helpers (called from DOMContentLoaded below)
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (Math.random() * 10 + 10) + 's';
        p.style.animationDelay = Math.random() * 5 + 's';
        container.appendChild(p);
    }
}

function generateReport() {
    const button = event.target;
    button.textContent = '⚡ GENERATING REPORT... ⚡';
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
        button.textContent = '✅ REPORT GENERATED ✅';
        button.style.transform = 'scale(1)';
        setTimeout(() => { button.textContent = '⚡ GENERATE THREAT REPORT ⚡'; }, 2000);
    }, 1500);
}

function initParallax() {
    document.querySelectorAll('.clause-parallax-item').forEach(item => {
        item.addEventListener('mousemove', e => {
            const rect = item.getBoundingClientRect();
            const angleX = (e.clientY - rect.top - rect.height / 2) / 20;
            const angleY = (rect.width / 2 - (e.clientX - rect.left)) / 20;
            item.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) translateX(10px)`;
        });
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateX(10px)';
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { createParticles(); initParallax(); }, 100);
});

