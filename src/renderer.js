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
    let toastContainer = document.querySelector('.toast-container') || document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none';
        document.body.appendChild(toastContainer);
    } else {
        toastContainer.className = 'fixed bottom-4 right-4 z-[1060] flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none';
    }

    const toastId = 'toast-' + Date.now() + Math.floor(Math.random() * 1000);
    const bgHeader = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-emerald-600' : type === 'warning' ? 'bg-amber-600' : 'bg-blue-600';
    const bgBody = 'bg-neutral-800 text-neutral-100 border border-neutral-700';

    toastContainer.insertAdjacentHTML('beforeend', `
        <div id="${toastId}" class="pointer-events-auto flex flex-col rounded-lg shadow-xl overflow-hidden transition-all duration-300 transform translate-y-2 opacity-0">
            <div class="${bgHeader} px-3 py-2 text-white font-bold flex justify-between items-center text-sm">
                <span>${title}</span>
                <button type="button" class="text-white hover:text-gray-200 focus:outline-none ml-4" onclick="this.closest('#${toastId}').remove()">✕</button>
            </div>
            <div class="${bgBody} p-3 text-sm">
                <div>${message}</div>
                ${link ? `<div class="mt-2 pt-2 border-t border-neutral-700"><a href="${link.url}" class="inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-full px-3 py-1 text-xs transition">${link.text}</a></div>` : ''}
            </div>
        </div>
    `);

    const toastEl = document.getElementById(toastId);
    setTimeout(() => {
        if (toastEl) toastEl.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        if (toastEl) {
            toastEl.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toastEl.remove(), 300);
        }
    }, 6000);
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
                        <span class="progress-backlog" style="color: #fbbf24; font-weight: bold; display: none;"></span>
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
            const backlogEl = progressContainer.querySelector('.progress-backlog');

            if (data.title) {
                // Tronquer un peu le titre s'il est trop long pour la notif
                const truncatedTitle = data.title.length > 35 ? data.title.substring(0, 35) + '...' : data.title;
                titleEl.textContent = truncatedTitle;
                titleEl.title = data.title;
            }
            
            if (backlogEl) {
                if (data.backlogLength && data.backlogLength > 0) {
                    backlogEl.textContent = `+${data.backlogLength} en attente`;
                    backlogEl.style.display = 'inline';
                } else {
                    backlogEl.style.display = 'none';
                }
            }

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

        const cleanupBtn = document.getElementById('cleanup-btn');
        if (cleanupBtn) {
            cleanupBtn.addEventListener('click', () => {
                const days = prompt('Supprimer les vidéos non lues depuis combien de jours ?', '30');
                if (days === null) return;
                const daysInt = parseInt(days, 10);
                if (isNaN(daysInt) || daysInt <= 0) {
                    showToast('Erreur', 'Veuillez saisir un nombre de jours valide.', 'danger');
                    return;
                }
                cleanupBtn.disabled = true;
                cleanupBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Nettoyage...';
                fetch(`/maintenance/cleanup?days=${daysInt}`)
                    .then(res => res.json())
                    .then(data => {
                        showToast('Maintenance', data.message || 'Nettoyage terminé.', 'success');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    })
                    .catch(err => {
                        console.error(err);
                        showToast('Erreur', 'Impossible de lancer le nettoyage.', 'danger');
                        cleanupBtn.disabled = false;
                        cleanupBtn.textContent = '🧹 Nettoyer vidéos';
                    });
            });
        }

        const syncChannelsBtn = document.getElementById('sync-channels-btn');
        if (syncChannelsBtn) {
            syncChannelsBtn.addEventListener('click', () => {
                syncChannelsBtn.disabled = true;
                syncChannelsBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sync...';
                showToast('Synchronisation', 'Recherche de nouvelles vidéos sur vos chaînes suivies...', 'info');
                fetch('/maintenance/check-channels')
                    .then(res => res.json())
                    .then(data => {
                        showToast('Synchronisation', data.message || 'Synchronisation lancée avec succès.', 'success');
                        setTimeout(() => {
                            syncChannelsBtn.disabled = false;
                            syncChannelsBtn.innerHTML = '🔄 Sync chaînes';
                        }, 3000);
                    })
                    .catch(err => {
                        console.error(err);
                        showToast('Erreur', 'Impossible de synchroniser les chaînes.', 'danger');
                        syncChannelsBtn.disabled = false;
                        syncChannelsBtn.innerHTML = '🔄 Sync chaînes';
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

    // Événements de synchronisation des chaînes via WebSocket
    socket.on('channel-check-started', (data) => {
        showToast('Synchronisation', `Démarrage de la vérification de ${data.total} chaîne(s) suivie(s)...`, 'info');
        const btn = document.getElementById('sync-channels-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sync...';
        }
    });

    socket.on('channel-check-progress', (data) => {
        showToast('Synchronisation', `Vérification (${data.current}/${data.total}) : ${data.channelName}`, 'info');
    });

    socket.on('channel-new-videos', (data) => {
        showToast('Nouvelles vidéos', `${data.count} nouvelle(s) vidéo(s) ajoutée(s) pour la chaîne ${data.channelName} !`, 'success');
    });

    socket.on('channel-check-error', (data) => {
        showToast('Erreur Synchronisation', `Échec de la vérification pour la chaîne ${data.channelName} : ${data.error}`, 'danger');
    });

    socket.on('channel-check-finished', (data) => {
        showToast('Synchronisation terminée', `La vérification est finie. ${data.totalAdded} nouvelle(s) vidéo(s) ont été ajoutées au backlog.`, 'success');
        const btn = document.getElementById('sync-channels-btn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔄 Sync chaînes';
        }
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    });
}
