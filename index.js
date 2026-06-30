require('dotenv').config();

const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const admin = require('firebase-admin');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

const serviceAccount = require('./firebase-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.database();

const WIDGET_PATH = process.env.FIREBASE_WIDGET_PATH || 'widgets/player';

function calcWorldLevel(ar) {
  if (ar < 20) return 0;
  if (ar < 25) return 1;
  if (ar < 30) return 2;
  if (ar < 35) return 3;
  if (ar < 40) return 4;
  if (ar < 45) return 5;
  if (ar < 50) return 6;
  if (ar < 55) return 7;
  if (ar < 60) return 8;
  return 9;
}

async function fetchGenshinStats(uid, cookieString, server) {
  const url = `https://bbs-api-os.hoyolab.com/game_record/genshin/api/index?server=${server}&role_id=${uid}`;

  const response = await axios.get(url, {
    headers: {
      'Cookie': cookieString,
      'Referer': 'https://act.hoyolab.com',
      'Origin': 'https://act.hoyolab.com',
      'x-rpc-app_version': '1.5.0',
      'x-rpc-client_type': '5',
      'x-rpc-language': 'en-us',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });

  const data = response.data;

  if (data.retcode !== 0) {
    throw new Error(`HoYoLAB API Error [${data.retcode}]: ${data.message}`);
  }

  return data.data;
}

async function updateDiscordProfileWidget(data) {
  const APP_ID = process.env.DISCORD_APP_ID;
  const USER_ID = process.env.DISCORD_USER_ID;
  const TOKEN = process.env.DISCORD_TOKEN;

  const widgetPayload = {
    data: {
      dynamic: [
        { type: 1, name: "adventure_rank", value: String(data.adventureRank) },
        { type: 1, name: "characters", value: String(data.characterCount) },
        { type: 1, name: "achievements", value: String(data.achievements) },
        { type: 1, name: "max_friendship", value: String(data.maxFriendship) },
        { type: 1, name: "days_active", value: String(data.daysActive) },
        { type: 1, name: "world_level", value: String(data.worldLevel) },
      ]
    }
  };

  const response = await axios.patch(
    `https://discord.com/api/v9/applications/${APP_ID}/users/${USER_ID}/identities/0/profile`,
    widgetPayload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${TOKEN}`,
        'User-Agent': 'DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)',
      }
    }
  );

  if (response.status !== 200 && response.status !== 204) {
    throw new Error(`Discord Widget PATCH failed: ${response.status} ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

app.get('/', (req, res) => {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };

  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <title>Genshin Stats Widget</title>
      <style>
          body {
            font-family: 'Segoe UI', sans-serif;
            background-color: transparent;
            color: white;
            margin: 0;
            padding: 20px;
          }
          .widget-container {
            background-color: #1e1e1e;
            width: 400px;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            border: 1px solid #333;
          }
          .widget-header {
            padding: 20px;
            background: linear-gradient(90deg, #1e1e1e 50%, #4a5c9a 100%);
            border-bottom: 1px solid #333;
          }
          .header-info .title {
            font-size: 12px;
            font-weight: bold;
            color: #ccc;
            display: block;
            margin-bottom: 15px;
          }
          .header-info h1 { margin: 0 0 5px 0; font-size: 24px; }
          .header-info p  { margin: 0; color: #aaa; font-size: 14px; }
          .widget-body {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            padding: 20px;
          }
          .stat-box h2 { margin: 0 0 5px 0; font-size: 20px; }
          .stat-box p  { margin: 0; color: #aaa; font-size: 12px; }
          .discord-profile { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #333; }
          .discord-info { display: flex; flex-direction: column; }
      </style>
  </head>
  <body>
      <div class="widget-container">
          <div class="widget-header">
              <div class="header-info">
                  <span class="title">✨ STATS</span>
                  <h1 id="widget-name">Loading...</h1>
                  <p id="widget-server">Server: --</p>
              </div>
              <div class="discord-profile">
                  <img id="discord-avatar" src="" alt="avatar" style="width:48px;height:48px;border-radius:50%;display:none;border:2px solid #5865F2;">
                  <div class="discord-info">
                      <span id="discord-tag" style="font-size:13px;font-weight:bold;color:#5865F2;"></span>
                      <span id="discord-status-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-left:6px;background:#747f8d;"></span>
                      <p id="discord-custom" style="margin:2px 0 0;font-size:12px;color:#aaa;"></p>
                  </div>
              </div>
          </div>
          <div class="widget-body">
              <div class="stat-box"><h2 id="widget-ar">-</h2><p>Adventure Rank</p></div>
              <div class="stat-box"><h2 id="widget-characters">-</h2><p>Characters</p></div>
              <div class="stat-box"><h2 id="widget-achievements">-</h2><p>Achievements</p></div>
              <div class="stat-box"><h2 id="widget-maxfriendship">-</h2><p>Max Friendship</p></div>
              <div class="stat-box"><h2 id="widget-days">-</h2><p>Days Active</p></div>
              <div class="stat-box"><h2 id="widget-wl">-</h2><p>World Level</p></div>
              <div class="stat-box"><h2 id="widget-discord-online">-</h2><p>Discord Online</p></div>
          </div>
      </div>

      <script type="module">
          import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
          import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

          const firebaseConfig = ${JSON.stringify(firebaseConfig)};

          const firebaseApp = initializeApp(firebaseConfig);
          const database    = getDatabase(firebaseApp);
          const statsRef    = ref(database, '${WIDGET_PATH}');

          onValue(statsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
              document.getElementById("widget-name").innerText         = data.name;
              document.getElementById("widget-server").innerText       = "Server: " + data.server;
              document.getElementById("widget-ar").innerText           = data.adventureRank;
              document.getElementById("widget-characters").innerText   = data.characterCount;
              document.getElementById("widget-achievements").innerText = data.achievements;
              document.getElementById("widget-maxfriendship").innerText = data.maxFriendship;
              document.getElementById("widget-days").innerText         = data.daysActive;
              document.getElementById("widget-wl").innerText           = data.worldLevel;
              if (data.discordOnline !== undefined)
                document.getElementById("widget-discord-online").innerText = data.discordOnline;

              if (data.discordAvatar) {
                const avatar = document.getElementById("discord-avatar");
                avatar.src     = data.discordAvatar;
                avatar.style.display = 'inline-block';
              }
              if (data.discordTag)
                document.getElementById("discord-tag").innerText = data.discordTag;
              if (data.discordCustom)
                document.getElementById("discord-custom").innerText = data.discordCustom;

              const statusColors = { online: '#23a55a', idle: '#f0b232', dnd: '#f23f43', offline: '#747f8d' };
              const dot = document.getElementById("discord-status-dot");
              if (dot && data.discordStatus)
                dot.style.background = statusColors[data.discordStatus] || '#747f8d';
            }
          });
      </script>
  </body>
  </html>
  `);
});

app.listen(port, () => {
  console.log(`[Widget] Running! Open it in OBS via: http://localhost:${port}`);
});

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

async function runStatsUpdate() {
  const uid = process.env.GENSHIN_UID;
  const server = process.env.GENSHIN_SERVER || 'os_euro';
  const playerName = process.env.PLAYER_NAME || 'Player';
  const serverLabel = process.env.PLAYER_SERVER_LABEL || 'Europe';
  const cookie = process.env.HOYOLAB_COOKIE;

  const genshinData = await fetchGenshinStats(uid, cookie, server);
  const stats = genshinData.stats;
  const ar = genshinData.role.level;

  const updatedData = {
    name: playerName,
    server: serverLabel,
    adventureRank: ar,
    characterCount: stats.avatar_number,
    achievements: stats.achievement_number,
    maxFriendship: stats.full_fetter_avatar_num ?? 0,
    daysActive: stats.active_day_number,
    worldLevel: calcWorldLevel(ar),
  };

  await db.ref(WIDGET_PATH).set(updatedData);
  await updateDiscordProfileWidget(updatedData);

  return updatedData;
}

discordClient.on('clientReady', () => {
  console.log(`[Discord] Logged in as: ${discordClient.user.tag}`);

  const INTERVAL_MS = 5 * 60 * 1000;

  async function autoUpdate() {
    try {
      await runStatsUpdate();
      console.log(`[Auto] Updated successfully — ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('[Auto Error]', err.message);
    }
  }

  autoUpdate();
  setInterval(autoUpdate, INTERVAL_MS);
});

discordClient.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!update_widget') {
    await message.reply('Updating widget and fetching data... ⏳');

    try {
      await runStatsUpdate();
      await message.reply('✅ Update complete! Your Discord profile widget has been refreshed 🎮');
    } catch (error) {
      console.error('[Error]', error.message);
      if (error.message.includes('-100') || error.message.includes('Cookie')) {
        await message.reply('❌ Cookie expired or invalid. Refresh your HoYoLAB cookie.');
      } else if (error.message.includes('10102')) {
        await message.reply('❌ Account is private or UID is wrong. Make sure your HoYoLAB profile is public.');
      } else {
        await message.reply(`❌ Error: ${error.message}`);
      }
    }
  }
});

discordClient.login(process.env.DISCORD_TOKEN);
