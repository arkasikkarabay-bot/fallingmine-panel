const express = require('express');
const cors = require('cors');
const Rcon = require('rcon');

const app = express();
app.use(cors());
app.use(express.json());

const SERVER_IP = process.env.MINECRAFT_IP || 'fallingmine.ddns.net';
const RCON_PORT = Number(process.env.RCON_PORT || 25575);
const RCON_PASSWORD = process.env.RCON_PASSWORD || '';
const PORT = Number(process.env.PORT || 3000);

const players = {};

app.get('/health', (req, res) => {
  res.json({ status: 'OK', server: SERVER_IP, rconPort: RCON_PORT });
});

app.get('/api/balance/:playerNick', (req, res) => {
  const nick = req.params.playerNick;
  const balance = players[nick] || 0;
  res.json({ nick, balance });
});

app.post('/api/earn', (req, res) => {
  const { playerNick, amount } = req.body;

  if (!playerNick || !amount) {
    return res.status(400).json({ error: 'Нужны playerNick и amount' });
  }

  if (!players[playerNick]) {
    players[playerNick] = 0;
  }

  players[playerNick] += Number(amount);

  res.json({
    success: true,
    message: `⛏ +${amount} флингов игроку ${playerNick}`,
    balance: players[playerNick],
  });
});

app.post('/api/buy', async (req, res) => {
  const { playerNick, donatType, price } = req.body;

  if (!playerNick || !donatType || !price) {
    return res.status(400).json({ error: 'Необходимы playerNick, donatType и price' });
  }

  const parsedPrice = Number(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Некорректная цена' });
  }

  if (!players[playerNick]) {
    players[playerNick] = 0;
  }

  if (players[playerNick] < parsedPrice) {
    return res.status(402).json({ error: 'Не хватает флингов' });
  }

  let command = '';
  if (donatType === 'Деревня') {
    command = `lp user ${playerNick} parent add village`;
  } else if (donatType === 'Герцог') {
    command = `lp user ${playerNick} parent add duke`;
  } else if (donatType === 'Император') {
    command = `lp user ${playerNick} parent add emperor`;
  } else {
    return res.status(400).json({ error: 'Неизвестный тип доната' });
  }

  try {
    const rcon = new Rcon({
      host: SERVER_IP,
      port: RCON_PORT,
      password: RCON_PASSWORD,
      timeout: 5000,
    });

    await rcon.connect();
    const rconResponse = await rcon.send(command);
    await rcon.close();

    players[playerNick] -= parsedPrice;

    res.json({
      success: true,
      message: `✅ "${donatType}" выдан игроку ${playerNick}`,
      balance: players[playerNick],
      rconResponse,
    });
  } catch (error) {
    console.error('RCON error:', error);
    res.status(500).json({
      error: 'Ошибка подключения к серверу',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`FallingMine backend запущен на порту ${PORT}`);
  console.log(`Подключение к серверу: ${SERVER_IP}:${RCON_PORT}`);
});
