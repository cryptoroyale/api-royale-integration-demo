// Required modules
const express = require('express');
const session = require('express-session');
const sharedsession = require("express-socket.io-session");
const undici = require('undici');
const http = require('http');
const socketio = require('socket.io');
const { APIClient } = require('./royaleApiClient');

// Server configuration
const app = express();
const server = http.Server(app);
const io = socketio.listen(server);

const PORT = process.env.PORT || 8080;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const ROYALE_API_KEY = process.env.ROYALE_API_KEY;

const REDIRECT_URL = "/api/discord/redirect/";
const ABSOLUTE_REDIRECT_URL = `http://localhost:${PORT}${REDIRECT_URL}`;

const params_for_oauth = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: ABSOLUTE_REDIRECT_URL,
    scope: "identify",
});

const OAUTH_URL = `https://discord.com/api/oauth2/authorize?${params_for_oauth}`;
const APP_ID = ROYALE_API_KEY.substring(0, 5);
const PERMS_URL = `https://cryptoroyale.one/apps/?id=${APP_ID}`

const apiClient = new APIClient(ROYALE_API_KEY)

const sessionMiddleware = session({
    secret: process.env.SECRET_SESSION,
    cookie: { maxAge: 8*60*60 },
    resave: true,
    saveUninitialized: true,
});
app.use(sessionMiddleware);
io.use(sharedsession(sessionMiddleware, {
    autoSave:true,
}));

app.set('view engine', 'ejs');

app.use(express.static(`${__dirname}/public`));

app.get('/', (req, res) => {
    if(req.session.authenticated){
        return res.redirect('/game/');
    }
    res.render('index', {oauth_url: OAUTH_URL, perms_url: PERMS_URL});
});

app.get('/game/', async (req, res) => {
    if(!req.session.authenticated){
        return res.redirect('/');
    }

    const perms = await apiClient.userPermissions(req.session.authenticated.discordUser.id);
    console.log(perms)
    if(!perms.increment){
        res.render('index', {
            oauth_url: OAUTH_URL,
            perms_url: PERMS_URL,
            error_msg: 'Missing permission for increment. Allow it before joining a game.',
        });
    }

    res.render('game');
});

app.get(REDIRECT_URL, async (req, res) => {
  if(req.session.authenticated){
    return res.redirect('/game/');
  }

    const { code } = req.query;

    if (code) {
        try {
            const tokenResponseData = await undici.request('https://discord.com/api/oauth2/token', {
                method: 'POST',
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: ABSOLUTE_REDIRECT_URL,
                    scope: 'identify',
                }).toString(),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const oauthData = await tokenResponseData.body.json();

            const discordUserResponseData = await undici.request('https://discordapp.com/api/users/@me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${oauthData.access_token}`,
                },
            });

            const discordUserData = await discordUserResponseData.body.json();

            req.session.authenticated = {oauth: oauthData, discordUser: discordUserData};
            return res.redirect('/game/');
        } catch (error) {
            // NOTE: An unauthorized token will not throw an error
            // tokenResponseData.statusCode will be 401
            console.error(error);
        }
    }

    return res.redirect('/');
});

server.listen(PORT, () => console.log(`Server listening at http://localhost:${PORT}`));

const players = {};
const star = {
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50,
};
const scores = {
    cyan: 0,
    magenta: 0,
};
const gameState = {
    finished: false,
    winner: '',
    prize: 0.01,
};
const playerToDiscordID = {};

io.on('connection', socket => {
    if(gameState.finished){
        socket.emit('gameOver', gameState);
        return;
    }
    console.log(`${socket.id} connected`);
    console.log(socket.handshake.session.authenticated);
    playerToDiscordID[socket.id] = socket.handshake.session.authenticated.discordUser.id;
    players[socket.id] = {
        rotation: 0,
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 700) + 50,
        playerId: socket.id,
        team: (Math.floor(Math.random() * 2) == 0 ? 'magenta' : 'cyan'),
    };
    // send players obj to the new player
    socket.emit('currentPlayers', players);
    // send the star object to the new player
    socket.emit('starLocation', star);
    // send the current scores
    socket.emit('scoreUpdate', scores);
    // update all other players with new player
    socket.broadcast.emit('newPlayer', players[socket.id]);
    // disconnect
    socket.on('disconnect', () => {
        console.log(`${socket.id} disconnected`);
        delete players[socket.id];
        delete playerToDiscordID[socket.id];
        io.emit('disconnect', socket.id);
    });
    // when a player moves, update the player data
    socket.on('playerMovement', data => {
        if(gameState.finished) return;
        const p = players[socket.id];
        p.x = data.x;
        p.y = data.y;
        p.rotation = data.rotation;
        // emit message to all player about the player that moved
        socket.broadcast.emit('playerMoved', p);
    });

    socket.on('starCollected', async () => {
        if(gameState.finished) return;
        console.log(players[socket.id].team + 'collected star');
        scores[players[socket.id].team] += 10;
        star.x = Math.floor(Math.random() * 700) + 50;
        star.y = Math.floor(Math.random() * 500) + 50;
        
        if(scores.magenta >= 100 || scores.cyan >= 100){
            gameState.finished = true;
            gameState.winner = scores.magenta >= 100 ? 'magenta' : 'cyan';
            io.emit('gameOver', gameState);
            console.log("playerToDiscordID", playerToDiscordID);
            for(const playerSocketID in playerToDiscordID){
                if(players[playerSocketID].team == gameState.winner){
                    await apiClient.increment(playerToDiscordID[playerSocketID], 0.01, 'Demo App Win');
                }
            }
        } else {
            io.emit('starLocation', star);
        }

        io.emit('scoreUpdate', scores);
    });
});
