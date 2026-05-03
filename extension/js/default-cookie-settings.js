document.addEventListener('DOMContentLoaded', () => {
    // Load saved preference
    chrome.storage.local.get(['defaultCookieSetting', 'customCookies'], (result) => {
        const setting = result.defaultCookieSetting || 'none';
        updateUI(setting);
        
        if (result.customCookies) {
            document.getElementById('toggle-performance').checked = !!result.customCookies.performance;
            document.getElementById('toggle-necessary').checked = !!result.customCookies.necessary;
            document.getElementById('toggle-marketing').checked = !!result.customCookies.marketing;
        }
    });

    // Add click listeners to the buttons
    document.getElementById('btn-accept').addEventListener('click', () => {
        setPreference('acceptAll');
    });

    document.getElementById('btn-reject').addEventListener('click', () => {
        setPreference('rejectAll');
    });

    document.getElementById('btn-none').addEventListener('click', () => {
        setPreference('none');
    });

    document.getElementById('btn-custom').addEventListener('click', () => {
        document.getElementById('custom-cookie-modal').style.display = 'flex';
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('custom-cookie-modal').style.display = 'none';
    });

    document.getElementById('save-custom-btn').addEventListener('click', () => {
        const customSettings = {
            performance: document.getElementById('toggle-performance').checked,
            necessary: document.getElementById('toggle-necessary').checked,
            marketing: document.getElementById('toggle-marketing').checked
        };
        chrome.storage.local.set({ defaultCookieSetting: 'custom', customCookies: customSettings }, () => {
            updateUI('custom');
            document.getElementById('custom-cookie-modal').style.display = 'none';
        });
    });
});

function setPreference(setting) {
    chrome.storage.local.set({ defaultCookieSetting: setting }, () => {
        updateUI(setting);
    });
}

function updateUI(setting) {
    // Reset all cards and buttons
    document.querySelectorAll('.setting-card').forEach(card => card.classList.remove('selected'));
    document.querySelectorAll('.select-btn').forEach(btn => {
        if (btn.id === 'btn-custom') {
            btn.textContent = 'Customise Options';
        } else {
            btn.textContent = 'Select Option';
        }
        btn.classList.remove('active-btn');
    });
    
    // Update selected card and button
    if (setting === 'acceptAll') {
        document.getElementById('card-accept').classList.add('selected');
        const btn = document.getElementById('btn-accept');
        btn.innerHTML = '<i class="fas fa-check"></i> Selected';
        btn.classList.add('active-btn');
    } else if (setting === 'rejectAll') {
        document.getElementById('card-reject').classList.add('selected');
        const btn = document.getElementById('btn-reject');
        btn.innerHTML = '<i class="fas fa-check"></i> Selected';
        btn.classList.add('active-btn');
    } else if (setting === 'custom') {
        document.getElementById('card-custom').classList.add('selected');
        const btn = document.getElementById('btn-custom');
        btn.innerHTML = '<i class="fas fa-check"></i> Selected / Edit';
        btn.classList.add('active-btn');
    } else {
        document.getElementById('card-none').classList.add('selected');
        const btn = document.getElementById('btn-none');
        btn.innerHTML = '<i class="fas fa-check"></i> Selected';
        btn.classList.add('active-btn');
    }
}
