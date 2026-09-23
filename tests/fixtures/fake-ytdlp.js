// Faux yt-dlp pour les tests : imprime les lignes de sortie typiques puis
// reste vivant un moment pour simuler un téléchargement en cours.
// Usage : node|bun fake-ytdlp.js [fail]
const mode = process.argv[2] || 'success';

console.log('[download] Destination: C:/fake/Video [dQw4w9WgXcQ].mp4');
console.log('[download] 100.0% of 10.00MiB at 5.00MiB/s ETA 00:00');

// Rester vivant après avoir imprimé "100%" pour que le test puisse vérifier
// qu'aucune émission n'a lieu tant que le processus n'est pas terminé.
setTimeout(() => {
  process.exit(mode === 'fail' ? 1 : 0);
}, 800);
