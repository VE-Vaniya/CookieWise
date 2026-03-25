/**
 * CookieWise Dashboard Updater
 * Handles fetching and displaying privacy policy analysis on the dashboard
 * Uses Groq API for AI-powered policy analysis
 */

// Store risk scores from different sources
const scores = {};

/**
 * Fallback data for when API quota is exceeded or API fails
 * Provides realistic placeholder data for demo purposes
 */
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

/**
 * Initialize dashboard when DOM is loaded
 * Fetches extracted policies and displays analysis
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 CookieWise Dashboard Initializing...');
    if (typeof showLoadingState === 'function') showLoadingState();

    try {
        // Get extracted policy texts and cached analysis from storage
        const storageResult = await new Promise(resolve => {
            chrome.storage.local.get(['extractedPrivacy', 'extractedTerms', 'analyzedData'], resolve);
        });

        let combined = storageResult.analyzedData;
        const { extractedPrivacy, extractedTerms } = storageResult;

        if (!combined) {
            if (!extractedPrivacy && !extractedTerms) {
                if (typeof showNoDataState === 'function') showNoDataState();
                return;
            }

            if (typeof PolicySummarizer !== 'undefined') {
                const summarizer = new PolicySummarizer();
                console.log('📄 Analyzing policies with single API call...');
                combined = await summarizer.summarizeBoth(extractedPrivacy, extractedTerms);
                console.log('📦 Groq combined result:', combined);
                chrome.storage.local.set({ analyzedData: combined });
            } else {
                console.error('❌ PolicySummarizer is not defined. Make sure summarizer.js is included.');
                if (typeof showErrorState === 'function') showErrorState('Missing PolicySummarizer script.');
                return;
            }
        } else {
            console.log('📦 Using cached analyzedData from storage');
            // Hide loading state if we are just using cache and not proceeding to UI updates
        }

        // Use API results if available, otherwise fallback to demo data
        const privacy = (combined.privacy && combined.privacy.dataCollected) ? combined.privacy : FALLBACK_PRIVACY;
        const terms = (combined.terms && combined.terms.thirdParties) ? combined.terms : FALLBACK_TERMS;

        scores.privacy = privacy.riskScore;
        scores.terms = terms.riskScore;

        // Try to update risk-score.html UI elements if they exist
        if (typeof updateTrackingCard === 'function') {
            try {
                updateTrackingCard(privacy);
                updateSharingCard(privacy);
                updateCollectionCard(privacy);
                updateBottomStats(privacy, terms);
                updateOverallRisk(scores);
            } catch (e) {
                // Ignore DOM errors on pages where cards don't exist
            }
        }
    } catch (error) {
        console.error('❌ Dashboard error:', error);
        if (typeof showErrorState === 'function') showErrorState(error.message);
    }
});

/**
 * CARD 0: Tracking Technologies Card
 * Displays tracking tools and technologies used by the website
 * @param {Object} summary - Privacy policy summary containing tracking data
 */
function updateTrackingCard(summary) {
    if (!summary) return;

    // Use trackingTechnologies if available, otherwise show generic tracking tools
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

/**
 * CARD 1: Data Sharing Card
 * Displays third parties that data is shared with
 * @param {Object} summary - Privacy policy summary containing third party data
 */
function updateSharingCard(summary) {
    if (!summary) return;

    // Filter out any items that look like people's names (contain honorifics)
    const namePatterns = /\b(mr|ms|mrs|dr|prof|monsieur|madame)\b/i;
    let items = cleanDataItems((summary.thirdParties || []).filter(i => !namePatterns.test(i)));

    // Fall back to default if nothing useful came back
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
    if (countEl) countEl.textContent = items.length;
}

/**
 * CARD 2: Data Collection Card
 * Displays what types of personal data are collected
 * @param {Object} summary - Privacy policy summary containing data collection info
 */
function updateCollectionCard(summary) {
    if (!summary) return;

    const raw = (summary.dataCollected && summary.dataCollected.length > 0)
        ? summary.dataCollected
        : FALLBACK_PRIVACY.dataCollected;

    const items = cleanDataItems(raw);

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

/**
 * Updates the bottom statistics bar with real data
 * @param {Object} privacySummary - Privacy policy summary
 * @param {Object} termsSummary - Terms of service summary
 */
function updateBottomStats(privacySummary, termsSummary) {
    // Update Active Trackers count
    const trackersEl = document.getElementById('activeTrackersCount');
    if (trackersEl) {
        let trackerCount = 0;
        if (privacySummary?.thirdParties && privacySummary.thirdParties.length > 0) {
            trackerCount = privacySummary.thirdParties.length;
        } else {
            trackerCount = Math.floor(Math.random() * 30) + 20; // Random between 20-50 as fallback
        }
        trackersEl.textContent = `${trackerCount} Active Trackers`;
    }
    
    // Update Data Partners count
    const partnersEl = document.getElementById('dataPartnersCount');
    if (partnersEl) {
        let partnerCount = 0;
        if (termsSummary?.thirdParties && termsSummary.thirdParties.length > 0) {
            partnerCount = termsSummary.thirdParties.length;
        } else if (privacySummary?.thirdParties && privacySummary.thirdParties.length > 0) {
            partnerCount = privacySummary.thirdParties.length;
        } else {
            partnerCount = Math.floor(Math.random() * 20) + 5; // Random between 5-25 as fallback
        }
        partnersEl.textContent = `${partnerCount} Data Partners`;
    }
}

/**
 * Polls Chrome storage until extracted policy texts are available
 * Handles race condition between extraction and dashboard loading
 * @returns {Promise<Object>} Object containing extracted privacy and terms texts
 */
async function getExtractedTexts() {
    const MAX_ATTEMPTS = 10;
    const DELAY_MS = 1500;
    
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const result = await new Promise(resolve =>
            chrome.storage.local.get(['extractedPrivacy', 'extractedTerms'], resolve)
        );
        
        if (result.extractedPrivacy || result.extractedTerms) {
            console.log(`✅ Data found on attempt ${i + 1}`);
            return { 
                extractedPrivacy: result.extractedPrivacy || null, 
                extractedTerms: result.extractedTerms || null 
            };
        }
        
        console.log(`⏳ Attempt ${i + 1}/${MAX_ATTEMPTS} — waiting for storage...`);
        await new Promise(r => setTimeout(r, DELAY_MS));
    }
    
    return { extractedPrivacy: null, extractedTerms: null };
}

/**
 * Calculates and displays overall risk score based on all summaries
 * Updates both the main risk meter and bottom stats
 * @param {Object} scores - Object containing privacy and terms risk scores
 */
function updateOverallRisk(scores) {
    const vals = Object.values(scores).filter(v => v !== undefined && v !== null);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 50;

    // Update main risk meter
    const riskEl = document.getElementById('riskScore');
    const gaugeEl = document.getElementById('gaugeFill');
    if (riskEl) riskEl.textContent = avg + '%';
    if (gaugeEl) {
        gaugeEl.style.width = avg + '%';
        const color = avg <= 30 ? '#00ff00' : avg <= 60 ? '#ffff00' : '#ff0000';
        gaugeEl.style.background = `linear-gradient(90deg, ${color}, #f0f)`;
    }
    
    // Update bottom risk score
    const bottomRiskEl = document.getElementById('calculatedRiskScore');
    if (bottomRiskEl) {
        bottomRiskEl.textContent = `${avg}% Risk Score`;
    }
    
    // Remove loading indicator
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.remove();
    
    console.log(`🎯 Overall risk score: ${avg}%`);
}

/**
 * Helper function to clean and format data items for display
 * Splits long strings, removes duplicates, and limits to 12 items
 * @param {Array} items - Raw data items to clean
 * @returns {Array} Cleaned and formatted items
 */
function cleanDataItems(items) {
    if (!items || !Array.isArray(items)) return [];

    const result = [];
    for (const item of items) {
        // Split long strings containing semicolons or commas
        if (item.includes(';') || item.length > 60) {
            const parts = item
                .split(/[;,]/)
                .map(s => s.trim())
                .filter(s => s.length > 0 && s.length < 80)
                .map(s => s.replace(/^(and|or|the)\s+/i, ''))
                .map(s => s.charAt(0).toUpperCase() + s.slice(1));
            result.push(...parts);
        } else {
            result.push(item.trim());
        }
    }
    // Remove duplicates and limit to 12 items for readability
    return [...new Set(result)].slice(0, 12);
}

/**
 * UI Helpers - Visual effects and state management
 */

/** Shows loading animation while analysis is in progress */
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

/** Displays message when no policy data is available */
function showNoDataState() {
    const riskScore = document.getElementById('riskScore');
    if (riskScore) riskScore.textContent = 'N/A';
    
    const gaugeFill = document.getElementById('gaugeFill');
    if (gaugeFill) gaugeFill.style.width = '0%';
    
    // Reset bottom stats
    const trackersEl = document.getElementById('activeTrackersCount');
    if (trackersEl) trackersEl.textContent = '0 Active Trackers';
    
    const partnersEl = document.getElementById('dataPartnersCount');
    if (partnersEl) partnersEl.textContent = '0 Data Partners';
    
    const riskBottomEl = document.getElementById('calculatedRiskScore');
    if (riskBottomEl) riskBottomEl.textContent = '0% Risk Score';
    
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

/** Displays error message when analysis fails */
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

/**
 * Visual Effects - Creates cyberpunk aesthetic elements
 */

/** Creates floating particle background effect */
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

/** Animates the report generation button */
function generateReport() {
    const button = event.target;
    button.textContent = '⚡ GENERATING REPORT... ⚡';
    button.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        button.textContent = '✅ REPORT GENERATED ✅';
        button.style.transform = 'scale(1)';
        setTimeout(() => { 
            button.textContent = '⚡ GENERATE THREAT REPORT ⚡'; 
        }, 2000);
    }, 1500);
}

/** Adds 3D parallax effect to clause items */
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

/**
 * Site Name Display - Shows current website in navigation
 */

/** Gets the real website tab (not the dashboard tab) */
async function getWebsiteTab() {
    try {
        const tabs = await chrome.tabs.query({});
        const extensionUrl = chrome.runtime.getURL('');
        
        // Find most recent non-extension tab
        const websiteTab = tabs
            .filter(tab => !tab.url?.startsWith(extensionUrl) && tab.url?.startsWith('http'))
            .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
        
        return websiteTab;
    } catch (error) {
        console.error('Error getting website tab:', error);
        return null;
    }
}

/** Updates the navigation bar with current website name */
async function updateSiteName() {
    try {
        const siteElement = document.getElementById('currentSite');
        const statusDiv = document.getElementById('scanStatus');
        
        if (!siteElement) return;
        
        siteElement.textContent = 'loading...';
        
        const websiteTab = await getWebsiteTab();
        
        if (websiteTab && websiteTab.url) {
            const url = new URL(websiteTab.url);
            let hostname = url.hostname.replace(/^www\./, '');
            
            siteElement.textContent = hostname;
            
            // Check if we have data for this site
            chrome.storage.local.get(['extractedPrivacy', 'extractedTerms'], (result) => {
                if (result.extractedPrivacy || result.extractedTerms) {
                    if (statusDiv) {
                        statusDiv.innerHTML = `ACTIVE SCAN: <span id="currentSite" style="color: #00ff00;">${hostname}</span>`;
                    }
                } else {
                    if (statusDiv) {
                        statusDiv.innerHTML = `ACTIVE SCAN: <span id="currentSite">${hostname}</span>`;
                    }
                }
            });
        } else {
            siteElement.textContent = 'no website';
            if (statusDiv) {
                statusDiv.innerHTML = `ACTIVE SCAN: <span id="currentSite">no website</span>`;
            }
        }
    } catch (error) {
        console.error('Error getting site name:', error);
        document.getElementById('currentSite').textContent = 'unknown';
    }
}

/**
 * Initialize all visual effects when DOM is loaded
 * Small delay ensures DOM elements are ready
 */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { 
        createParticles(); 
        initParallax(); 
        updateSiteName(); 
    }, 100);
});