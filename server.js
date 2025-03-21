const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const resources = ['❤️', '📖', '👥', '💼', '💰', '🍀'];
const stages = {
    childhood: [
        { name: '学会骑自行车', cost: ['❤️', '📖'], score: 3, desc: '掌握一项基本技能' },
        { name: '参加夏令营', cost: ['👥'], score: 2, desc: '结交新朋友' },
        { name: '赢得拼字游戏', cost: ['📖'], score: 4, desc: '展现你的聪明才智' },
        { name: '宠物陪伴', cost: ['❤️'], score: 3, desc: '有个忠诚的小伙伴' },
    ],
    adulthood: [
        { name: '成为医生', cost: ['❤️', '📖', '💼'], score: 12, desc: '救死扶伤的职业' },
        { name: '创业成功', cost: ['💼', '💰', '🍀'], score: 15, desc: '打造自己的商业帝国' },
        { name: '结婚生子', cost: ['👥', '💰'], score: 10, desc: '组建幸福家庭' },
        { name: '环球旅行', cost: ['💰', '❤️'], score: 8, desc: '探索世界各地' },
        { name: '彩票中奖', cost: ['🍀'], score: 10, desc: '意外之财降临', effect: 'gain_resource' },
        { name: '职场竞争', cost: ['💼', '🍀'], score: 5, desc: '击败对手升职', effect: 'steal_resource' },
    ],
    old_age: [
        { name: '退休养老', cost: ['💰', '💼'], score: 20, desc: '享受悠闲时光' },
        { name: '出版自传', cost: ['📖', '👥'], score: 15, desc: '分享人生故事' },
        { name: '慈善捐款', cost: ['💰', '💰'], score: 18, desc: '回馈社会' },
        { name: '健康长寿', cost: ['❤️', '❤️'], score: 16, desc: '活到100岁' },
        { name: '家族聚会', cost: ['👥', '💰'], score: 12, desc: '与亲人团聚' },
    ]
};

const adjectives = ['快乐的', '勇敢的', '聪明的', '幸运的', '温柔的'];
const nouns = ['小熊', '小猫', '小狗', '小鸟', '小鱼'];
function generateRandomName() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}`;
}

class Game {
    constructor() {
        this.players = {};
        this.names = new Set();
        this.currentPlayer = 0;
        this.stage = 'childhood';
        this.availableCards = [];
        this.gameOver = false;
        this.maxPlayers = 4;
        this.readyCount = 0;
        this.gameStarted = false;
    }

    addPlayer(id, name, isAI = false) {
        if (Object.keys(this.players).length >= this.maxPlayers || this.names.has(name)) return false;
        this.players[id] = {
            name,
            resources: { '❤️': 0, '📖': 0, '👥': 0, '💼': 0, '💰': 0, '🍀': 0 },
            cards: [],
            score: 0,
            isAI,
            ready: isAI
        };
        this.names.add(name);
        if (isAI) this.readyCount++;
        return true;
    }

    rollDice() {
        return Array(4).fill().map(() => resources[Math.floor(Math.random() * 6)]);
    }

    canBuyCard(player, card) {
        return card.cost.every(r => player.resources[r] > 0);
    }

    applyCardEffect(playerId, card) {
        if (card.effect === 'gain_resource') {
            const resource = resources[Math.floor(Math.random() * 6)];
            this.players[playerId].resources[resource]++;
        } else if (card.effect === 'steal_resource') {
            for (let id in this.players) {
                if (id !== playerId && this.players[id].resources['💼'] > 0) {
                    this.players[id].resources['💼']--;
                    this.players[playerId].resources['💼']++;
                    break;
                }
            }
        }
    }

    nextTurn() {
        this.currentPlayer = (this.currentPlayer + 1) % Object.keys(this.players).length;
        if (this.availableCards.length === 0) {
            this.stage = this.stage === 'childhood' ? 'adulthood' : this.stage === 'adulthood' ? 'old_age' : null;
            if (!this.stage) {
                this.gameOver = true;
            } else {
                this.availableCards = [...stages[this.stage]];
            }
        }
    }

    aiPlay(socketId) {
        const player = this.players[socketId];
        const dice = this.rollDice();
        player.resources = dice.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
        for (let i = 0; i < this.availableCards.length; i++) {
            if (this.canBuyCard(player, this.availableCards[i])) {
                return i;
            }
        }
        return -1; // AI跳过
    }

    getGameState() {
        return {
            players: this.players,
            stage: this.stage,
            cards: this.availableCards,
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            gameStarted: this.gameStarted
        };
    }

    allReady() {
        return Object.values(this.players).filter(p => !p.isAI).every(p => p.ready) && Object.keys(this.players).length >= 2;
    }

    startGame() {
        this.gameStarted = true;
        while (Object.keys(this.players).length < this.maxPlayers) {
            let aiName;
            do {
                aiName = generateRandomName();
            } while (this.names.has(aiName));
            const aiId = `AI_${Object.keys(this.players).length}`;
            this.addPlayer(aiId, aiName, true);
            console.log(`AI玩家 ${aiName} 已加入`);
        }
        this.availableCards = [...stages[this.stage]];
        io.emit('start', this.getGameState());
    }

    removePlayer(id) {
        if (this.players[id]) {
            this.names.delete(this.players[id].name);
            this.readyCount -= this.players[id].ready && !this.players[id].isAI ? 1 : 0;
            delete this.players[id];
        }
    }
}

const game = new Game();

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.on('setName', (name) => {
        let playerName = name.trim() || generateRandomName();
        if (game.names.has(playerName)) {
            socket.emit('nameError', '名称已存在，请输入其他名称');
            return;
        }
        if (game.addPlayer(socket.id, playerName)) {
            console.log(`玩家 ${playerName} 已连接 (ID: ${socket.id.slice(0, 4)})`);
            socket.emit('nameSet', playerName);
            io.emit('update', game.getGameState());
        } else {
            socket.emit('error', '游戏已满，最多支持4人');
            socket.disconnect();
        }
    });

    socket.on('ready', () => {
        if (!game.players[socket.id] || game.players[socket.id].ready || game.gameStarted) return;
        game.players[socket.id].ready = true;
        game.readyCount++;
        io.emit('update', game.getGameState());
        if (game.allReady()) {
            game.startGame();
        }
    });

    socket.on('rollDice', () => {
        if (!game.gameStarted || socket.id !== Object.keys(game.players)[game.currentPlayer]) return;
        const dice = game.rollDice();
        game.players[socket.id].resources = dice.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
        io.emit('diceResult', { player: game.players[socket.id].name, dice });
        io.emit('update', game.getGameState());
    });

    socket.on('buyCard', (index) => {
        if (!game.gameStarted || socket.id !== Object.keys(game.players)[game.currentPlayer] || index < 0 || index >= game.availableCards.length) return;
        const card = game.availableCards[index];
        const player = game.players[socket.id];
        if (game.canBuyCard(player, card)) {
            player.cards.push(card);
            player.score += card.score;
            card.cost.forEach(r => player.resources[r]--);
            game.applyCardEffect(socket.id, card);
            game.availableCards.splice(index, 1);
            game.nextTurn();
            io.emit('update', game.getGameState());
            if (game.gameOver) {
                io.emit('gameOver', game.players);
            } else if (game.players[Object.keys(game.players)[game.currentPlayer]].isAI) {
                setTimeout(() => aiTurn(), 1000);
            }
        }
    });

    socket.on('skip', () => {
        if (!game.gameStarted || socket.id !== Object.keys(game.players)[game.currentPlayer]) return;
        game.nextTurn();
        io.emit('update', game.getGameState());
        if (game.gameOver) {
            io.emit('gameOver', game.players);
        } else if (game.players[Object.keys(game.players)[game.currentPlayer]].isAI) {
            setTimeout(() => aiTurn(), 1000);
        }
    });

    function aiTurn() {
        const aiId = Object.keys(game.players)[game.currentPlayer];
        if (!game.players[aiId].isAI) return;
        const dice = game.rollDice();
        game.players[aiId].resources = dice.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
        io.emit('diceResult', { player: game.players[aiId].name, dice });
        const cardIndex = game.aiPlay(aiId);
        if (cardIndex >= 0) {
            const card = game.availableCards[cardIndex];
            game.players[aiId].cards.push(card);
            game.players[aiId].score += card.score;
            card.cost.forEach(r => game.players[aiId].resources[r]--);
            game.applyCardEffect(aiId, card);
            game.availableCards.splice(cardIndex, 1);
        }
        game.nextTurn();
        io.emit('update', game.getGameState());
        if (game.gameOver) {
            io.emit('gameOver', game.players);
        } else if (game.players[Object.keys(game.players)[game.currentPlayer]].isAI) {
            setTimeout(() => aiTurn(), 1000);
        }
    }

    socket.on('disconnect', () => {
        if (game.players[socket.id]) {
            console.log(`玩家 ${game.players[socket.id].name} 已断开 (ID: ${socket.id.slice(0, 4)})`);
            game.removePlayer(socket.id);
            io.emit('update', game.getGameState());
        }
    });
});

server.listen(3000, () => console.log('服务器运行在 http://localhost:3000'));