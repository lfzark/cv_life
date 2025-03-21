const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let players = {};
let targetPosition = 200 + Math.random() * 500;

wss.on('connection', (ws) => {
    const id = Date.now().toString();

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'join') {
            players[id] = { 
                position: 50, 
                score: 0, 
                nickname: data.nickname || `玩家${id.slice(-4)}`
            };
            ws.send(JSON.stringify({ type: 'init', id }));
            broadcastState();
        } else if (data.type === 'jump') {
            const newPosition = Math.min(data.distance + 50, 750);
            players[data.id].position = newPosition;

            const distanceToTarget = Math.abs(newPosition - targetPosition);
            const score = Math.max(100 - Math.floor(distanceToTarget / 2), 0);
            players[data.id].score += score;

            if (distanceToTarget < 50) {
                targetPosition = 200 + Math.random() * 500;
            }

            broadcastState();
        }
    });

    ws.on('close', () => {
        delete players[id];
        broadcastState();
    });
});

function broadcastState() {
    const state = {
        type: 'update',
        players,
        target: targetPosition
    };
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(state));
        }
    });
}

console.log('Server running on ws://localhost:8080');