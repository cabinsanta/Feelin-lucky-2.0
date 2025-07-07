const express = require('express');
const cors = require('cors');
//const rateLimit = require('express-rate-limit');
const axios = require('axios');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

let presses = {};
const COOLDOWN_HOURS = 24;
const MAX_CLICKS = 3;

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
}

app.use('/random', (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    if (!presses[ip]) {
        presses[ip] = { count: 0, lastReset: now, values: [] };
    }
    const elapsed = now - presses[ip].lastReset;

    if (elapsed > COOLDOWN_HOURS * 3600000) {
        presses[ip] = { count: 0, lastReset: now, values: [] };
    }

    if (presses[ip].count >= MAX_CLICKS) {
        return res.status(429).json({ message: 'Cooldown active. Try again later.' });
    }

    next();
});

app.get('/random', async (req, res) => {
    const ip = getClientIp(req);
    const num = Math.floor(Math.random() * 5001);
    const options = ['btc', 'eth', 'link'];
    const abbrev = options[Math.floor(Math.random() * options.length)];

    presses[ip].count += 1;
    presses[ip].values.push({ num, abbrev });

    try {
        const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,chainlink&vs_currencies=usd');
        const prices = {
            btc: data.bitcoin.usd,
            eth: data.ethereum.usd,
            link: data.chainlink.usd
        };

        const results = presses[ip].values;
        const totalUSD = results.reduce((sum, r) => sum + r.num * prices[r.abbrev], 0);

        res.json({
            current: { num, abbrev },
            results,
            totalUSD,
            remaining: MAX_CLICKS - presses[ip].count,
            prices
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching prices' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
