// popup/popup.js
document.getElementById('downloadBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  statusEl.textContent = "Récupération de l'URL de la vidéo...";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    statusEl.textContent = "Aucun onglet actif trouvé.";
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: "getVideoUrl" }, async (response) => {
    if (!response || !response.videoUrl) {
      statusEl.textContent = "Aucune vidéo YouTube détectée.";
      return;
    }

    statusEl.textContent = "Envoi de la demande à l'API...";

    // URL de l'API locale ou hébergée
    const apiUrl = `http://localhost:3000/download?url=${encodeURIComponent(response.videoUrl)}&type=mp4`;

    try {
      const apiResponse = await fetch(apiUrl);

      if (!apiResponse.ok) {
        statusEl.textContent = `Erreur HTTP: ${apiResponse.status} ${apiResponse.statusText}`;
        return;
      }

      const result = await apiResponse.json();

      if (result.status === "success") {
        statusEl.textContent = `Téléchargement lancé: ${result.title}`;
        // Ouvre le lien de téléchargement dans un nouvel onglet
        chrome.tabs.create({ url: `http://localhost:3000/downloads/${result.filename}` });
      } else {
        statusEl.textContent = `Erreur: ${result.message}`;
      }
    } catch (error) {
      statusEl.textContent = `Erreur API: ${error.message}`;
    }
  });
});