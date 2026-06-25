// Shared renderer utilities (loaded before page scripts in both views)

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('commandForm');
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const url = document.getElementById('commandInput').value;
            if (window.electronAPI) {
                window.electronAPI.setTitle(url);
            } else {
                window.location.href = `/download?url=${encodeURIComponent(url)}`;
            }
        });
    }
});

// --- Debounce utility ---
function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// --- Toast Notifications ---
function showToast(title, message, type = 'primary', link = null) {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;

    const toastId = 'toast-' + Date.now() + Math.floor(Math.random() * 1000);
    const bgClass = type === 'error' ? 'bg-danger' : 'bg-primary';
    const btnClass = type === 'error' ? 'btn-danger' : 'btn-primary';

    toastContainer.insertAdjacentHTML('beforeend', `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="15000">
            <div class="toast-header ${bgClass} text-white">
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
                ${link ? `<div class="mt-2 pt-2 border-top"><a href="${link.url}" class="btn ${btnClass} btn-sm">${link.text}</a></div>` : ''}
            </div>
        </div>
    `);

    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// --- Queue ---
async function addToQueue(videoId) {
    try {
        const data = await fetch(`/queue/add?id=${videoId}`, { headers: { Accept: 'application/json' } }).then(r => r.json());
        if (data.success) {
            const btn = document.querySelector('a[href="/queue"]');
            if (btn) btn.textContent = `File (${data.queueCount})`;
        }
    } catch (err) {
        console.error('Erreur ajout file :', err);
    }
}

// --- Favorites ---
async function toggleFavorite(videoId, btn) {
    try {
        const data = await fetch(`/favorite/toggle?id=${videoId}`, { headers: { Accept: 'application/json' } }).then(r => r.json());
        if (!data.success) return;

        const favNav = document.querySelector('a[href="/favorites"]');
        if (favNav) favNav.textContent = `Favoris (${data.favoritesCount})`;

        // View page uses #favoriteBtn, index page passes the button element
        const favBtn = btn || document.getElementById('favoriteBtn');
        if (favBtn) {
            if (data.isFavorite) {
                favBtn.classList.replace('btn-outline-danger', 'btn-danger');
                if (favBtn.id === 'favoriteBtn') favBtn.textContent = '❤ Favori';
            } else {
                favBtn.classList.replace('btn-danger', 'btn-outline-danger');
                if (favBtn.id === 'favoriteBtn') favBtn.textContent = '♡ Favori';
                // On favorites page, remove the card
                if (typeof channel !== 'undefined' && channel === 'Mes Favoris') {
                    favBtn.closest('.video-item')?.remove();
                }
            }
        }
    } catch (err) {
        console.error('Erreur toggle favori :', err);
    }
}

// --- Channel download ---
function downloadChannel(url) {
    if (window.electronAPI && window.electronAPI.setTitle) {
        window.electronAPI.setTitle(url);
        showToast('Téléchargement', 'Téléchargement de la chaîne lancé !', 'primary');
    } else {
        window.location.href = `/download?url=${encodeURIComponent(url)}`;
    }
}

// --- Folder picker ---
async function changeFolder() {
    if (window.electronAPI && window.electronAPI.selectFolder) {
        const newPath = await window.electronAPI.selectFolder();
        if (newPath) showToast('Succès', `Le dossier de téléchargement est maintenant : ${newPath}`, 'primary');
    } else {
        alert("La sélection de dossier n'est disponible que dans la version application.");
    }
}

// --- Socket.io notifications (shared) ---
if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('error-notification', (data) => showToast('Erreur', data.message, 'error'));
    socket.on('download-finished', (data) => {
        showToast(
            'Téléchargement terminé',
            `<span class="fw-bold">${data.title}</span> est maintenant disponible.`,
            'primary',
            { url: `/watch?id=${data.videoId}`, text: 'Regarder' }
        );
    });
    socket.on('chat message', (msg) => {
        const consoleLogs = document.getElementById('consoleLogs');
        const downloadConsole = document.getElementById('downloadConsole');
        if (downloadConsole && consoleLogs) {
            downloadConsole.style.display = 'block';
            msg.split(/\r?\n/).filter(l => l.trim()).forEach(line => {
                const div = document.createElement('div');
                div.className = 'mb-1 border-bottom border-secondary pb-1';
                div.textContent = line;
                consoleLogs.appendChild(div);
            });
            while (consoleLogs.children.length > 1000) consoleLogs.removeChild(consoleLogs.firstChild);
            downloadConsole.scrollTop = downloadConsole.scrollHeight;
        }
    });
}
