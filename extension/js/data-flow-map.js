(() => {
    const FLAGS = {
        usa: '🇺🇸', eu: '🇪🇺', uk: '🇬🇧', cn: '🇨🇳', in: '🇮🇳', br: '🇧🇷', au: '🇦🇺', jp: '🇯🇵', ru: '🇷🇺'
    };
    
    let ACTIVE_DATA = {};

    function animateCount(id, target, dur) {
        const el = document.getElementById(id);
        if (!el) return;
        let start = null;
        function step(ts) {
            if (!start) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            el.textContent = Math.round(p * target);
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function renderMap() {
        const wrap = document.getElementById('dfm2MapWrap');
        const tooltip = document.getElementById('dfm2Tooltip');
        if (!wrap || !tooltip) return;

        // Hide all nodes and paths first
        Object.keys(FLAGS).forEach(id => {
            const group = document.querySelector(`.dfm2-dest-g[data-id="${id}"]`);
            const path = document.getElementById(`dfm2p-${id}`);
            const pkt = document.getElementById(`dpkt-${id}`);
            if (group) group.style.display = 'none';
            if (path) path.style.display = 'none';
            if (pkt) pkt.style.display = 'none';
        });

        // Show active ones
        let highRiskCount = 0;
        let consentReqCount = 0;
        let legitCount = 0;
        let thirdCount = 0;

        Object.keys(ACTIVE_DATA).forEach(id => {
            const info = ACTIVE_DATA[id];
            const group = document.querySelector(`.dfm2-dest-g[data-id="${id}"]`);
            const path = document.getElementById(`dfm2p-${id}`);
            const pkt = document.getElementById(`dpkt-${id}`);
            const pkt2 = document.getElementById(`dpkt-${id}2`); // specifically cn2 if exists

            if (group) group.style.display = '';
            if (path) path.style.display = '';
            if (pkt) pkt.style.display = '';
            if (pkt2) pkt2.style.display = '';

            // Only add tooltips once
            if (group && !group.hasAttribute('data-tooltip-init')) {
                group.setAttribute('data-tooltip-init', 'true');
                group.addEventListener('mouseenter', (e) => {
                    document.getElementById('dfm2TtCountry').textContent = info.flag + ' ' + info.name;
                    const riskEl = document.getElementById('dfm2TtRisk');
                    riskEl.textContent = info.risk.toUpperCase() + ' RISK';
                    riskEl.className = 'dfm2-tt-risk ' + info.risk;
                    document.getElementById('dfm2TtDesc').textContent = info.desc;
                    document.getElementById('dfm2TtConsent').textContent = 'Consent type: ' + info.consent;
                    tooltip.style.display = 'block';
                });

                group.addEventListener('mousemove', (e) => {
                    const wr = wrap.getBoundingClientRect();
                    let lx = e.clientX - wr.left + 14;
                    let ly = e.clientY - wr.top - 14;
                    if (lx + 250 > wr.width) lx -= 260;
                    if (ly < 0) ly = 10;
                    tooltip.style.left = lx + 'px';
                    tooltip.style.top = ly + 'px';
                });

                group.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });
            }

            if (info.risk === 'high' || info.risk === 'critical') highRiskCount++;
            if (info.consent?.toLowerCase().includes('consent')) consentReqCount++;
            else if (info.consent?.toLowerCase().includes('third')) thirdCount++;
            else legitCount++;
        });

        // Update stats
        const totalDest = Object.keys(ACTIVE_DATA).length;
        animateCount('dfm2c1', totalDest, 1200);
        animateCount('dfm2c2', highRiskCount, 1000);

        const bdContainer = document.querySelector('.dfm2-breakdown');
        if (bdContainer) {
            bdContainer.innerHTML = `
                <div><span class="dfm2-bd-dot" style="background:#ffd93d;box-shadow:0 0 6px #ffd93d"></span> Consent Required: ${consentReqCount}</div>
                <div><span class="dfm2-bd-dot" style="background:#818cf8;box-shadow:0 0 6px #818cf8"></span> Legitimate Interest: ${legitCount}</div>
                <div><span class="dfm2-bd-dot" style="background:#ff6b6b;box-shadow:0 0 6px #ff6b6b"></span> 3rd Party: ${thirdCount}</div>
            `;
        }
    }

    function loadAiData() {
        chrome.storage.local.get(['analyzedData'], (res) => {
            if (res.analyzedData && res.analyzedData.privacy && res.analyzedData.privacy.dataFlow) {
                const flows = res.analyzedData.privacy.dataFlow;
                ACTIVE_DATA = {};
                flows.forEach(f => {
                    if (FLAGS[f.id]) {
                        ACTIVE_DATA[f.id] = {
                            flag: FLAGS[f.id],
                            name: f.name || f.id.toUpperCase(),
                            risk: f.risk || 'medium',
                            consent: f.consent || 'Unknown',
                            desc: f.desc || ''
                        };
                    }
                });
            } else {
                // Empty state if no AI data
                ACTIVE_DATA = {};
            }
            renderMap();
        });
    }

    function initSection() {
        const section = document.getElementById('heatmap');
        if (!section) return;

        loadAiData();

        const obs = new MutationObserver(() => {
            if (section.classList.contains('active-section')) {
                loadAiData(); // Reload incase updated
            }
        });
        obs.observe(section, { attributes: true, attributeFilter: ['class'] });

        // Listen for updates from dashboard-updater
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.analyzedData) {
                setTimeout(loadAiData, 100);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSection);
    } else {
        setTimeout(initSection, 80);
    }
})();
