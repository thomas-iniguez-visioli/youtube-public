
console.log(window.electronAPI.send)

// WebSocket client for logs
let ws = null;

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:3000');
    
    ws.onopen = () => {
        console.log('Connected to WebSocket server');
    };
    
    ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
        case 'prompt-ready':
            handlePrompt(message.data);
            break;
        case 'prompt-response':
            handlePromptResponse(message.data);
            break;
        case 'download-result':
            displayLogMessage(`Download completed: ${message.data}`);
            break;
        case 'download-data-result':
            displayLogMessage(`Download data received: ${message.data}`);
            break;
        case 'queue-update':
            handleQueueUpdate(message.data);
            break;
        case 'queue-list':
            displayQueue(message.data);
            break;
        default:
            displayLogMessage(message.data);
    }
};
        const message = JSON.parse(event.data);
        
        switch (message.type) {
            case 'download-result':
                displayLogMessage(`Download completed: ${message.data}`);
                break;
            case 'download-data-result':
                displayLogMessage(`Download data received: ${message.data}`);
                break;
            case 'queue-update':
                handleQueueUpdate(message.data);
                break;
            case 'queue-list':
                displayQueue(message.data);
                break;
            default:
                displayLogMessage(message.data);
        }
    };
    
    ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
        // Try to reconnect after 2 seconds
        setTimeout(connectWebSocket, 2000);
    };
}

function initializePromptInterface() {
    // Create prompt interface elements
    const promptContainer = document.createElement('div');
    promptContainer.id = 'prompt-container';
    promptContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 300px;
        padding: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 5px;
        display: none;
    `;

    const promptForm = document.createElement('form');
    promptForm.id = 'prompt-form';
    promptForm.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

    const promptTitle = document.createElement('h3');
    promptTitle.id = 'prompt-title';
    promptTitle.style.cssText = 'margin: 0 0 10px 0;';

    const promptInput = document.createElement('input');
    promptInput.type = 'text';
    promptInput.id = 'prompt-input';
    promptInput.style.cssText = 'padding: 8px; border: 1px solid rgba(255, 255, 255, 0.2);';

    const promptButtons = document.createElement('div');
    promptButtons.style.cssText = 'display: flex; gap: 10px;';

    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.cssText = 'flex: 1; padding: 8px; background: #4CAF50; border: none; color: white; cursor: pointer;';
    okButton.onclick = () => sendPromptResponse(promptInput.value);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = 'flex: 1; padding: 8px; background: #f44336; border: none; color: white; cursor: pointer;';
    cancelButton.onclick = () => sendPromptResponse(null);

    promptButtons.appendChild(okButton);
    promptButtons.appendChild(cancelButton);

    promptForm.appendChild(promptTitle);
    promptForm.appendChild(promptInput);
    promptForm.appendChild(promptButtons);
    promptContainer.appendChild(promptForm);
    document.body.appendChild(promptContainer);

    // Add event listener for form submission
    promptForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendPromptResponse(promptInput.value);
    });
}

function handlePrompt(data) {
    const promptContainer = document.getElementById('prompt-container');
    const promptTitle = document.getElementById('prompt-title');
    const promptInput = document.getElementById('prompt-input');

    promptTitle.textContent = data.title;
    promptInput.value = data.val || '';
    promptContainer.style.display = 'block';
}

function handlePromptResponse(response) {
    const promptContainer = document.getElementById('prompt-container');
    promptContainer.style.display = 'none';
    if (response !== null) {
        sendDownloadRequest(response);
    }
}

function sendPromptResponse(value) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'prompt-response',
            data: value
        }));
    }
}

function initializeDownloadInterface() {
    // Create download interface elements
    const container = document.createElement('div');
    container.id = 'download-container';
    container.style.cssText = `
        position: fixed;
        bottom: 200px;
        left: 0;
        width: 100%;
        height: 300px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        overflow-y: auto;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    `;

    // Download form
    const downloadForm = document.createElement('form');
    downloadForm.id = 'download-form';
    downloadForm.style.cssText = 'margin-bottom: 10px;';
    
    const downloadInput = document.createElement('input');
    downloadInput.type = 'text';
    downloadInput.placeholder = 'Enter video URL...';
    downloadInput.style.cssText = 'width: 70%; padding: 5px;';
    
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download';
    downloadButton.style.cssText = 'padding: 5px 10px; margin-left: 10px;';
    
    downloadForm.appendChild(downloadInput);
    downloadForm.appendChild(downloadButton);
    
    // Queue display
    const queueContainer = document.createElement('div');
    queueContainer.id = 'queue-container';
    queueContainer.style.cssText = 'margin-top: 10px;';
    
    const queueTitle = document.createElement('h3');
    queueTitle.textContent = 'Download Queue';
    queueTitle.style.cssText = 'margin: 0 0 10px 0;';
    
    queueContainer.appendChild(queueTitle);
    
    container.appendChild(downloadForm);
    container.appendChild(queueContainer);
    document.body.appendChild(container);

    // Add event listeners
    downloadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = downloadInput.value;
        if (url) {
            sendDownloadRequest(url);
            downloadInput.value = '';
        }
    });
}

function sendDownloadRequest(url) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'download',
            data: url
        }));
    }
}

function sendQueueRequest(action, videoId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'queue',
            data: {
                type: action,
                videoId: videoId
            }
        }));
    }
}

function handleQueueUpdate(update) {
    const queueContainer = document.getElementById('queue-container');
    const item = document.createElement('div');
    item.style.cssText = 'margin-bottom: 5px; padding: 5px; background: rgba(255, 255, 255, 0.1);';
    
    if (update.type === 'added') {
        item.textContent = `Added: ${update.videoId}`;
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.style.cssText = 'margin-left: 10px; padding: 2px 5px;';
        removeButton.onclick = () => sendQueueRequest('remove', update.videoId);
        item.appendChild(removeButton);
    } else if (update.type === 'removed') {
        item.textContent = `Removed: ${update.videoId}`;
    }
    
    queueContainer.appendChild(item);
}

function displayQueue(queue) {
    const queueContainer = document.getElementById('queue-container');
    queueContainer.innerHTML = '';
    const queueTitle = document.createElement('h3');
    queueTitle.textContent = 'Download Queue';
    queueTitle.style.cssText = 'margin: 0 0 10px 0;';
    queueContainer.appendChild(queueTitle);
    
    queue.forEach(videoId => {
        const item = document.createElement('div');
        item.style.cssText = 'margin-bottom: 5px; padding: 5px; background: rgba(255, 255, 255, 0.1);';
        item.textContent = videoId;
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.style.cssText = 'margin-left: 10px; padding: 2px 5px;';
        removeButton.onclick = () => sendQueueRequest('remove', videoId);
        item.appendChild(removeButton);
        queueContainer.appendChild(item);
    });
}

function displayLogMessage(message) {
    let logContainer = document.getElementById('log-container');
    if (!logContainer) {
        logContainer = document.createElement('div');
        logContainer.id = 'log-container';
        logContainer.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 200px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        `;
        document.body.appendChild(logContainer);
    }
    
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logEntry.style.marginBottom = '5px';
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}
// Function to handle video streaming
function streamVideo(videoId) {
    window.electronAPI.send('stream-video', videoId);
}
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    
    // Initialize download interface
    initializeDownloadInterface();
    
    // Initialize prompt interface
    initializePromptInterface();
    connectWebSocket();
    
    // Initialize download interface
    initializeDownloadInterface();
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
