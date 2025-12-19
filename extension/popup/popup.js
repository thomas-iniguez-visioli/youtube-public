const browserApi = typeof browser !== "undefined" ? browser : chrome;

document.getElementById('downloadBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  statusEl.textContent = "Récupération de l'URL de la vidéo...";

  const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    statusEl.textContent = "Aucun onglet actif trouvé.";
    return;
  }
  const response = await browserApi.tabs.sendMessage(tab.id, { action: "getVideoUrl" }).catch(() => null);
  const videoUrl = response?.videoUrl;
  if (!videoUrl) {
    statusEl.textContent = "Impossible de récupérer l'URL.";
    return;
  }

  statusEl.textContent = "Téléchargement en cours...";

  const apiUrl = `http://localhost:8001/download?url=${encodeURIComponent(videoUrl)}`;
  try {
    await fetch(apiUrl, { method: "GET", mode: "no-cors" });
    statusEl.textContent = "Téléchargement ajouté à la file.";
  } catch (error) {
    statusEl.textContent = `Erreur API: ${error.message}`;
  }
  });
