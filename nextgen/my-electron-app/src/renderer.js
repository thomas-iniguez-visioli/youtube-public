
console.log(window.electronAPI.send)
// Function to handle video streaming
function streamVideo(videoId) {
    window.electronAPI.send('stream-video', videoId);
}
document.addEventListener('DOMContentLoaded', () => {
    // Initialize application
    console.log('Renderer process initialized');
  
    // Set up event listeners
    const form = document.getElementById('commandForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const parameter = document.getElementById('commandInput').value;
      window.electronAPI.setTitle(parameter)
    });
  });
/*
// Function to handle user interactions
document.getElementById('playButton').addEventListener('click', () => {
    const videoId = document.getElementById('videoIdInput').value;
    streamVideo(videoId);
});
*/
// Function to receive messages from the main process
