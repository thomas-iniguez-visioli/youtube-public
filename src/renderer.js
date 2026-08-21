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
    if (!url || url === 'null' || url === 'undefined') {
        showToast('Erreur', 'Impossible de télécharger la chaîne : URL non disponible.', 'error');
        return;
    }
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

    // Transférer les logs et erreurs du front vers le back via WebSocket
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = (...args) => {
        originalLog.apply(console, args);
        socket.emit('front-log', { level: 'info', message: args.map(String).join(' ') });
    };
    console.warn = (...args) => {
        originalWarn.apply(console, args);
        socket.emit('front-log', { level: 'warn', message: args.map(String).join(' ') });
    };
    console.error = (...args) => {
        originalError.apply(console, args);
        socket.emit('front-log', { level: 'error', message: args.map(String).join(' ') });
    };
    console.info = (...args) => {
        originalInfo.apply(console, args);
        socket.emit('front-log', { level: 'info', message: args.map(String).join(' ') });
    };

    window.addEventListener('error', (event) => {
        socket.emit('front-log', { level: 'error', message: `Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}` });
    });
    window.addEventListener('unhandledrejection', (event) => {
        socket.emit('front-log', { level: 'error', message: `Unhandled Rejection: ${event.reason}` });
    });

    // Create Progress Card dynamically when DOM is fully loaded
    let progressContainer = null;
    document.addEventListener('DOMContentLoaded', () => {
        progressContainer = document.getElementById('global-download-progress');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'global-download-progress';
            progressContainer.className = 'download-progress-container';
            progressContainer.innerHTML = `
                <div class="download-progress-card">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="progress-title" style="font-size: 0.9rem; font-weight:600; color: #fff;">Téléchargement...</span>
                        <span class="progress-meta text-muted" style="font-size: 0.8rem;">0%</span>
                    </div>
                    <div class="progress" style="height: 6px; background-color: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); transition: width 0.2s ease;"></div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-2" style="font-size: 0.75rem; color: #a1a1aa;">
                        <span class="progress-speed">-- MB/s</span>
                        <span class="progress-eta">ETA: --:--</span>
                        <button class="btn btn-sm btn-danger py-0 px-2 cancel-download-btn" style="font-size: 0.7rem; border-radius: 4px; border: none; background-color: #ef4444; color: #fff;">Couper</button>
                    </div>
                </div>
            `;
            progressContainer.style.display = 'none';
            document.body.appendChild(progressContainer);
        }
    });

    socket.on('download-progress', (data) => {
        if (progressContainer) {
            progressContainer.style.display = 'block';
            
            const titleEl = progressContainer.querySelector('.progress-title');
            const percentEl = progressContainer.querySelector('.progress-meta');
            const barEl = progressContainer.querySelector('.progress-bar');
            const speedEl = progressContainer.querySelector('.progress-speed');
            const etaEl = progressContainer.querySelector('.progress-eta');

            const cancelBtn = progressContainer.querySelector('.cancel-download-btn');
            if (cancelBtn && !cancelBtn.dataset.hasListener) {
                cancelBtn.dataset.hasListener = "true";
                cancelBtn.addEventListener('click', () => {
                    cancelBtn.disabled = true;
                    cancelBtn.textContent = 'Coupe...';
                    fetch('/download/cancel', { method: 'POST' })
                        .then(res => res.json())
                        .then(res => {
                            cancelBtn.disabled = false;
                            cancelBtn.textContent = 'Couper';
                            if (res.success) {
                                progressContainer.style.display = 'none';
                            }
                        })
                        .catch(err => {
                            cancelBtn.disabled = false;
                            cancelBtn.textContent = 'Couper';
                            console.error("Erreur d'annulation:", err);
                        });
                });
            }

            let displayName = "Téléchargement...";
            if (data.parameter && data.parameter.includes('watch?v=')) {
                try {
                    const urlParams = new URLSearchParams(data.parameter.split('?')[1]);
                    if (urlParams.has('v')) displayName = `Vidéo (${urlParams.get('v')})`;
                } catch(e) {
                    displayName = data.parameter.substring(0, 30) + '...';
                }
            } else if (data.parameter) {
                displayName = data.parameter.substring(0, 30) + '...';
            }

            titleEl.textContent = displayName;
            percentEl.textContent = `${data.percent}%`;
            barEl.style.width = `${data.percent}%`;
            speedEl.textContent = data.speed ? data.speed : '-- MB/s';
            etaEl.textContent = data.eta ? `ETA: ${data.eta}` : 'ETA: --:--';
        }
    });

    socket.on('download-finished', (data) => {
        const speedText = data.speed ? ` (Vitesse : ${data.speed})` : '';
        showToast(
            'Téléchargement terminé',
            `<span class="fw-bold">${data.title}</span> est maintenant disponible.${speedText}`,
            'primary',
            { url: `/watch?id=${data.videoId}`, text: 'Regarder' }
        );
        if (progressContainer) {
            const percentEl = progressContainer.querySelector('.progress-meta');
            const barEl = progressContainer.querySelector('.progress-bar');
            if (percentEl) percentEl.textContent = '100%';
            if (barEl) barEl.style.width = '100%';
            setTimeout(() => {
                progressContainer.style.display = 'none';
                if (barEl) barEl.style.width = '0%';
            }, 2000);
        }
    });

    // Écouteur pour le bouton de recherche de mise à jour manuelle
    document.addEventListener('DOMContentLoaded', () => {
        const checkUpdateBtn = document.getElementById('check-update-btn');
        if (checkUpdateBtn) {
            checkUpdateBtn.addEventListener('click', () => {
                checkUpdateBtn.disabled = true;
                checkUpdateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Recherche...';
                fetch('/updater/check', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        showToast('Mise à jour', data.message || 'Vérification en cours...', 'info');
                        setTimeout(() => {
                            checkUpdateBtn.disabled = false;
                            checkUpdateBtn.textContent = '🔄 Chercher mise à jour';
                        }, 3000);
                    })
                    .catch(err => {
                        console.error(err);
                        showToast('Erreur', 'Impossible de lancer la recherche de mise à jour.', 'danger');
                        checkUpdateBtn.disabled = false;
                        checkUpdateBtn.textContent = '🔄 Chercher mise à jour';
                    });
            });
        }
    });

    // Événements d'auto-updater via WebSocket
    socket.on('update-status', (data) => {
        showToast('Mise à jour', data.message, 'info');
    });

    socket.on('update-available', (info) => {
        showToast('Mise à jour disponible', `La version ${info.version} est disponible et va être téléchargée en arrière-plan.`, 'primary');
    });

    socket.on('update-download-progress', (data) => {
        // Envoi optionnel d'un petit log ou toast si nécessaire
    });

    socket.on('update-downloaded', (info) => {
        showToast(
            'Mise à jour prête',
            `La version ${info.version} a été téléchargée avec succès.`,
            'success',
            { url: '#', text: 'Installer et redémarrer' }
        );
        
        // Attacher le redémarrage sur le bouton du toast s'il est cliqué
        setTimeout(() => {
            const toasts = document.querySelectorAll('.toast');
            toasts.forEach(toast => {
                const actionBtn = toast.querySelector('.btn-primary');
                if (actionBtn && actionBtn.textContent === 'Installer et redémarrer') {
                    actionBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        fetch('/updater/install', { method: 'POST' })
                            .catch(err => console.error("Erreur d'installation:", err));
                    });
                }
            });
        }, 500);
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
