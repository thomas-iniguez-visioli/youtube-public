
        const allVideos = <%- JSON.stringify(results) %>;
        let filteredVideos = [...allVideos];
        
        // Pagination
        let currentPage = 0;
        const itemsPerPage = 30;

        const resultsList = document.getElementById('resultsList');
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const searchInput = document.getElementById('fuzzySearchInput');

        const channel = <%= typeof channel !== 'undefined' ? JSON.stringify(channel) : 'null' %>;

        // Simple debounce
        function debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        function renderVideos(append = false) {
            if (!resultsList) return;
            if (!append) {
                resultsList.innerHTML = '';
                currentPage = 0;
            }

            const start = currentPage * itemsPerPage;
            const end = start + itemsPerPage;
            const pageVideos = filteredVideos.slice(start, end);

            pageVideos.forEach(result => {
                let playlistParam = '';
                if (channel) {
                    if (channel.startsWith('Playlist : ')) {
                        playlistParam = '&playlist=' + encodeURIComponent(channel.replace('Playlist : ', '')).replace(/'/g, "%27");
                    } else if (channel !== 'Mes Playlists' && channel !== 'Historique') {
                        playlistParam = '&playlist=' + encodeURIComponent('Channel: ' + channel).replace(/'/g, "%27");
                    }
                }

                const cardDiv = document.createElement('div');
                cardDiv.className = 'video-card video-item';
                const tags = Array.isArray(result.tags) ? result.tags : [];
                cardDiv.setAttribute('data-tags', tags.join(','));
                cardDiv.addEventListener('click', () => {
                    location.href = `/watch?id=${result.yid}${playlistParam}`;
                });
                
                let tagsHtml = tags.map(tag => `<span class="tag-badge">${tag}</span>`).join('');
                
                let actionBtns = `<div class="flex gap-1 mt-3 w-full flex-wrap" onclick="event.stopPropagation();">`;
                if (channel && channel.startsWith('Playlist : ')) {
                    actionBtns += `<button class="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-2 py-1 text-[10px] font-bold transition" onclick="if(confirm('Retirer de la playlist ?')) window.location.href='/playlist/remove?name=${encodeURIComponent(channel.replace('Playlist : ', ''))}&videoId=${result.yid}'">Retirer</button>`;
                }
                if (channel === "Ma File d'attente") {
                    actionBtns += `<button class="bg-amber-655 hover:bg-amber-700 text-white rounded-lg px-2 py-1 text-[10px] font-bold transition" onclick="window.location.href='/queue/remove?id=${result.yid}'">Retirer</button>`;
                } else {
                    actionBtns += `<button class="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold transition" onclick="addToQueue('${result.yid}')">File</button>`;
                }
                actionBtns += `<button class="bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg px-2.5 py-1 text-[10px] font-bold border border-red-500/20 transition" onclick="toggleFavorite('${result.yid}', this)">❤</button>`;
                actionBtns += `<button class="bg-red-655 hover:bg-red-700 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold transition" onclick="if(confirm('Supprimer cette vidéo ?')) window.location.href='/delete?id=${result.yid}'">Supprimer</button>`;
                actionBtns += `</div>`;
 
                cardDiv.innerHTML = `
                    <div class="video-thumb-container relative aspect-video bg-neutral-950 overflow-hidden">
                        <img data-src="/thumbnail/${result.yid}" src="" class="video-thumbnail w-full h-full object-cover lazy" alt="Thumbnail" loading="lazy">
                        ${result.isGz ? '<span class="absolute bottom-2 right-2 bg-neutral-900/90 text-neutral-300 text-[9px] px-1.5 py-0.5 rounded border border-neutral-750 font-semibold">📦 zip</span>' : ''}
                    </div>
                    <div class="video-info flex-1 flex flex-col justify-between gap-3">
                        <div class="min-w-0">
                            <div class="video-title" title="${result.fileName}">
                                ${result.fileName}
                            </div>
                            <div class="flex flex-col gap-1.5">
                                ${result.uploader ? `
                                    <div class="flex items-center gap-1.5 mt-1">
                                        <img src="/channel-logo/${encodeURIComponent(result.uploader)}" alt="Logo" class="w-5 h-5 rounded-full object-cover border border-neutral-850">
                                        <a href="/channel?name=${encodeURIComponent(result.uploader)}" onclick="event.stopPropagation();" class="text-neutral-400 hover:text-white transition text-xs font-semibold truncate">
                                            ${result.uploader}
                                        </a>
                                    </div>
                                ` : ''}
                                <div class="flex flex-wrap gap-1 mt-1">
                                    ${tagsHtml}
                                </div>
                            </div>
                        </div>
                        ${actionBtns}
                    </div>
                `;
                resultsList.appendChild(cardDiv);
            });

            if (end >= filteredVideos.length) {
                loadMoreContainer.style.display = 'none';
            } else {
                loadMoreContainer.style.display = 'block';
            }
        }

        // Initialize Fuse.js for search
        const fuse = new Fuse(allVideos, {
            keys: ['fileName', 'uploader'],
            threshold: 0.3,
            distance: 100,
            ignoreLocation: true
        });

        // Lazy-load thumbnails with IntersectionObserver
        const thumbObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    obs.unobserve(img);
                }
            });
        }, { rootMargin: '200px' });

        function observeLazyImages() {
            document.querySelectorAll('img.lazy').forEach(img => thumbObserver.observe(img));
        }

        // Initial render
        renderVideos();
        observeLazyImages();

        loadMoreBtn.addEventListener('click', () => {
            currentPage++;
            renderVideos(true);
            observeLazyImages();
        });

        // Debounced fuzzy search
        searchInput.addEventListener('input', debounce(function() {
            const query = this.value.trim();
            filteredVideos = query.length === 0 ? [...allVideos] : fuse.search(query).map(r => r.item);
            renderVideos();
            observeLazyImages();
        }, 250));

        function filterByTag(tag, element) {
            document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
            element.classList.add('active');
            filteredVideos = tag === 'all' ? [...allVideos] : allVideos.filter(v => v.tags.includes(tag));
            renderVideos();
            observeLazyImages();
        }

        function filterByChannel(uploader, element) {
            document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
            element.classList.add('active');
            filteredVideos = uploader === 'all' ? [...allVideos] : allVideos.filter(v => v.uploader === uploader);
            renderVideos();
            observeLazyImages();
        }

        // Gestion du retour à la dernière page visitée
        (function() {
            const lastUrlKey = 'last_visited_url';
            const sessionNavKey = 'has_navigated_this_session';
            const currentUrl = window.location.href;
            const lastUrl = localStorage.getItem(lastUrlKey);

            if (window.location.pathname === '/' && 
                lastUrl && 
                lastUrl !== currentUrl && 
                !lastUrl.includes('/suggestions') &&
                !sessionStorage.getItem(sessionNavKey)) {
                
                sessionStorage.setItem(sessionNavKey, 'true');
                window.location.href = lastUrl;
                return;
            }

            sessionStorage.setItem(sessionNavKey, 'true');
            localStorage.setItem(lastUrlKey, currentUrl);
        })();

        const commandForm = document.getElementById('commandForm');
        commandForm.addEventListener('submit', (e) => {
            if (!window.electronAPI) {
                e.preventDefault();
                const url = document.getElementById('commandInput').value;
                window.location.href = `/download?url=${encodeURIComponent(url)}`;
            }
        });

        function switchToPlaylistsTab(elem) {
            const playlistsTabButton = document.getElementById('playlists-tab');
            if (playlistsTabButton) {
                playlistsTabButton.click();
            }
        }
        
        async function addAllToQueue() {
            const ids = allVideos.map(v => v.yid);
            if (ids.length === 0) return;
            
            try {
                const response = await fetch('/queue/add_multiple', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ ids })
                });
                const data = await response.json();
                if (data.success) {
                    const btn = document.querySelector('a[href="/queue"]');
                    if (btn) {
                        btn.textContent = `File (${data.queueCount})`;
                    }
                    showToast('File d\'attente', 'Toutes les vidéos ont été ajoutées !', 'success');
                }
            } catch (e) {
                console.error(e);
                showToast('Erreur', 'Erreur lors de l\'ajout des vidéos à la file d\'attente.', 'error');
            }
        }

        async function toggleFollowChannel(channelName, channelUrl, btn) {
            const isCurrentlyFollowed = btn.classList.contains('btn-warning');
            const endpoint = isCurrentlyFollowed ? '/channel/unfollow' : '/channel/follow';
            try {
                btn.disabled = true;
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ name: channelName, url: channelUrl })
                });
                const data = await response.json();
                if (data.success) {
                    if (data.isFollowing) {
                        btn.className = 'btn btn-warning btn-sm';
                        btn.textContent = '✅ Suivi';
                        showToast('Chaîne suivie', `Vous suivez désormais ${channelName}. Les nouvelles vidéos seront téléchargées automatiquement.`, 'primary');
                    } else {
                        btn.className = 'btn btn-outline-warning btn-sm';
                        btn.textContent = '➕ Suivre cette chaîne';
                        showToast('Chaîne retirée', `Vous ne suivez plus ${channelName}.`, 'primary');
                    }
                } else {
                    showToast('Erreur', data.error || 'Action impossible.', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('Erreur', 'Impossible de modifier le suivi.', 'error');
            } finally {
                btn.disabled = false;
            }
        }

        if (typeof io !== 'undefined') {
            const _sock = typeof socket !== 'undefined' ? socket : io();
            _sock.on('channel-check-started', data => {
                if (data.total > 0) showToast('Sync chaînes', `Vérification de ${data.total} chaîne(s) suivie(s)...`, 'info');
            });
            _sock.on('channel-new-videos', data => {
                showToast('Nouvelles vidéos', `${data.count} nouvelle(s) vidéo(s) de <strong>${data.channelName}</strong> ajoutée(s) au téléchargement.`, 'primary');
            });
            _sock.on('channel-check-finished', data => {
                if (data.totalAdded > 0) {
                    showToast('Sync terminée', `${data.totalAdded} nouvelle(s) vidéo(s) ajoutée(s) au total.`, 'success');
                }
            });
        }

        // Vanilla tab switcher simulation
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(btn => {
            btn.addEventListener('click', function() {
                const targetId = this.getAttribute('data-bs-target');
                const targetPane = document.querySelector(targetId);
                
                // Toggle active link class
                this.closest('#mainTab').querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                    link.setAttribute('aria-selected', 'false');
                });
                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');
                
                // Toggle active pane class
                const paneParent = targetPane.parentElement;
                paneParent.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('show', 'active');
                });
                targetPane.classList.add('show', 'active');
            });
        });
    