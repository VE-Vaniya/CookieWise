// Generate floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        particle.style.animationDelay = Math.random() * 5 + 's';
        particlesContainer.appendChild(particle);
    }
}

createParticles();

// Navigation handled by HTML links

// Dynamic rendering logic for Dangerous Clauses
function renderClauses(analyzedData) {
    const container = document.getElementById('clausesContainer');
    
    if (!analyzedData) {
        container.innerHTML = `
            <div style="text-align: center; color: #ff6b6b; padding: 2rem; background: rgba(255,0,0,0.1); border-radius: 20px; border: 1px solid #ff6b6b;">
                <h3>⚠️ No Data Available</h3>
                <p style="margin-top: 10px; color: #94a3b8;">Please analyze a website with a cookie banner first.</p>
            </div>
        `;
        return;
    }

    const clauses = [
        ...(analyzedData.privacy?.dangerousClauses || []),
        ...(analyzedData.terms?.dangerousClauses || [])
    ];

    if (clauses.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #86efac; padding: 2rem; background: rgba(0,255,0,0.1); border-radius: 20px; border: 1px solid #86efac;">
                <h3>✅ Excellent!</h3>
                <p style="margin-top: 10px; color: #94a3b8;">No dangerous clauses were detected in the privacy policy or terms of service.</p>
            </div>
        `;
        return;
    }

    // Sort by severity descending
    clauses.sort((a, b) => b.severity - a.severity);

    let html = '';
    clauses.forEach(clause => {
        let color = '#ffd93d';
        let fillClass = 'medium';
        if (clause.severity >= 80) { color = '#ff6b6b'; fillClass = 'critical'; }
        else if (clause.severity >= 60) { color = '#ff6b00'; fillClass = 'high'; }

        html += `
            <div class="clause-parallax-item">
                <div class="clause-icon-3d">${clause.icon || '⚠️'}</div>
                <div style="flex: 1;">
                    <h3 style="color: ${color};">${clause.title}</h3>
                    <p style="color: #94a3b8;">${clause.description}</p>
                </div>
                <div class="severity-meter" style="--percent: ${clause.severity}">
                    <svg class="severity-svg" viewBox="0 0 100 100">
                        <circle class="severity-circle-bg" cx="50" cy="50" r="45"></circle>
                        <circle class="severity-circle-fill ${fillClass}" cx="50" cy="50" r="45"></circle>
                    </svg>
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem; color: ${color};">
                        ${clause.severity}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Re-initialize parallax event listeners for newly added elements
    document.querySelectorAll('.clause-parallax-item').forEach((item) => {
        item.addEventListener('mousemove', (e) => {
            const rect = item.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const angleX = (y - centerY) / 20;
            const angleY = (centerX - x) / 20;
            item.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) translateX(10px)`;
        });

        item.addEventListener('mouseleave', () => {
            item.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateX(10px)';
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // First load try
    chrome.storage.local.get(['analyzedData', 'extractedPrivacy', 'extractedTerms'], (result) => {
        if (result.analyzedData) {
            renderClauses(result.analyzedData);
        } else if (!result.extractedPrivacy && !result.extractedTerms) {
            // No data pending to be analyzed
            renderClauses(null);
        }
    });

    // Listen for changes from updater
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.analyzedData && changes.analyzedData.newValue) {
            renderClauses(changes.analyzedData.newValue);
        }
    });
});
