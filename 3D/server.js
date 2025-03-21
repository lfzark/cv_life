const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let players = {};

wss.on('connection', (ws) => {
    const id = Date.now().toString();

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'join') {
            players[id] = {
                x: 0,
                z: 0,
                cultivation: 0,
                meditating: false,
                nickname: data.nickname || `玩家${id.slice(-4)}`
            };
            ws.send(JSON.stringify({ type: 'init', id }));
            broadcastState();
        } else if (data.type === 'move') {
            players[data.id].x = data.x;
            players[data.id].z = data.z;
            broadcastState();
        } else if (data.type === 'meditate') {
            players[data.id].meditating = !players[data.id].meditating;
            if (players[data.id].meditating) {
                // 每秒增加修为
                players[data.id].interval = setInterval(() => {
                    players[data.id].cultivation += 1;
                    broadcastState();
                }, 1000);
            } else {
                clearInterval(players[data.id].interval);
            }
            broadcastState();
        }
    });

    ws.on('close', () => {
        if (players[id] && players[id].interval) {
            clearInterval(players[id].interval);
        }
        delete players[id];
        broadcastState();
    });
});

function broadcastState() {
    const state = {
        type: 'update',
        players
    };
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(state));
        }
    });
}

console.log('Server running on ws://localhost:8080');