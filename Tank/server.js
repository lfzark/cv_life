const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let players = {};
const maxPlayers = 8;
const defaultPlayers = 2;

wss.on('connection', (ws) => {
    console.log('New player connected');

    ws.id = Math.random().toString(36).substring(2, 9);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'join') {
            players[data.id] = { x: 400, y: 300, angle: 0, health: 3, score: 0, isAI: false };
            initializeAI();
        } else if (data.type === 'move') {
            if (players[data.id]) {
                players[data.id].x = data.x;
                players[data.id].y = data.y;
                players[data.id].angle = data.angle;
                players[data.id].health = data.health;
                players[data.id].score = data.score;
            }
        } else if (data.type === 'shoot') {
            broadcast({ type: 'shoot', id: data.id, x: data.x, y: data.y, angle: data.angle });
        } else if (data.type === 'hit') {
            if (players[data.targetId]) {
                players[data.targetId].health--;
                if (players[data.shooterId]) players[data.shooterId].score++;
            }
        }

        broadcast({ type: 'update', players });
    });

    ws.on('close', () => {
        if (ws.id && players[ws.id]) {
            delete players[ws.id];
        }
        console.log('Player disconnected');
        initializeAI();
        broadcast({ type: 'update', players });
    });
});

function initializeAI() {
    const humanCount = Object.keys(players).filter(id => !players[id].isAI).length;
    if (humanCount < defaultPlayers) {
        for (let i = humanCount; i < defaultPlayers; i++) {
            const aiId = `AI_${i}`;
            if (!players[aiId]) {
                players[aiId] = { 
                    x: Math.random() * 800, 
                    y: Math.random() * 600, 
                    angle: 0, 
                    health: 3, 
                    score: 0, 
                    isAI: true 
                };
            }
        }
    }
}

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

console.log('Server running on ws://localhost:8080');