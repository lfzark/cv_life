const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let players = {};

wss.on('connection', (ws) => {
    console.log('New player connected');

    ws.id = Math.random().toString(36).substring(2, 9);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'join') {
            players[data.id] = { x: data.x, y: data.y, health: data.health, facing: data.facing };
        } else if (data.type === 'move') {
            if (players[data.id]) {
                players[data.id].x = data.x;
                players[data.id].y = data.y;
                players[data.id].health = data.health;
                players[data.id].facing = data.facing;
            }
        } else if (data.type === 'hit' && players[data.id]) {
            players[data.id].health = data.health;
        }

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'update', players }));
            }
        });
    });

    ws.on('close', () => {
        if (ws.id && players[ws.id]) {
            delete players[ws.id];
        }
        console.log('Player disconnected');
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'update', players }));
            }
        });
    });
});

console.log('Server running on ws://localhost:8080');