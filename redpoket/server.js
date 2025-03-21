// server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let players = {};

wss.on('connection', (ws) => {
    console.log('New player connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'join') {
            players[data.id] = data.score;
        } else if (data.type === 'score') {
            players[data.id] = data.score;
        }

        // 广播更新
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'update', players }));
            }
        });
    });

    ws.on('close', () => {
        console.log('Player disconnected');
    });
});

console.log('Server running on ws://localhost:8080');