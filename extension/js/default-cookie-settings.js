document.addEventListener('DOMContentLoaded', () => {
    // Load saved preference
    chrome.storage.local.get(['defaultCookieSetting'], (result) => {
        const setting = result.defaultCookieSetting || 'none';
        updateUI(setting);
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
        btn.textContent = 'Select Option';
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
    } else {
        document.getElementById('card-none').classList.add('selected');
        const btn = document.getElementById('btn-none');
        btn.innerHTML = '<i class="fas fa-check"></i> Selected';
        btn.classList.add('active-btn');
    }
}
