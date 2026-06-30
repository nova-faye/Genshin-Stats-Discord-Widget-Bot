# Genshin Stats Discord Widget Bot

A Discord bot that pulls Genshin Impact stats from HoYoLAB, stores them in Firebase, displays them on a live local web widget (great for OBS overlays), and pushes them straight to a Discord profile's custom widget.

## Features

- Fetches Genshin Impact stats (Adventure Rank, characters, achievements, friendship, active days, world level) from HoYoLAB
- Saves stats to Firebase Realtime Database
- Live HTML widget served locally — perfect for OBS browser source
- Updates a Discord profile widget automatically
- Auto-refreshes every 5 minutes, plus a manual `!update_widget` command

## Requirements

- Node.js 18 or newer
- A Discord bot application with a configured Profile Widget (Application ID + Bot Token)
- A Firebase project with Realtime Database and a Web App configured
- A HoYoLAB account cookie

## Installation

```bash
npm install express discord.js firebase-admin axios dotenv
```

## Setup

### 1. Firebase service account

In the Firebase console, go to **Project Settings → Service Accounts → Generate New Private Key**, then save the downloaded file in the project root as:

```
firebase-key.json
```

### 2. Firebase Web App config

In the Firebase console, go to **Project Settings → General → Your apps**, add (or select) a Web App, and copy its config values — you'll need them for the `.env` file below.

### 3. Environment variables

Create a `.env` file in the project root:

```env
# Discord
DISCORD_TOKEN=your_discord_bot_token
DISCORD_APP_ID=your_discord_application_id
DISCORD_USER_ID=your_discord_user_id

# HoYoLAB
HOYOLAB_COOKIE=ltuid_v2=...;ltoken_v2=...
GENSHIN_UID=your_genshin_uid
GENSHIN_SERVER=os_euro
PLAYER_NAME=YourName
PLAYER_SERVER_LABEL=Europe

# Firebase (admin SDK)
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
FIREBASE_WIDGET_PATH=widgets/player

# Firebase (web app config, used by the browser widget)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_firebase_app_id

# Server
PORT=3000
```

**Getting your HoYoLAB cookie:**
1. Log in to [hoyolab.com](https://www.hoyolab.com) in your browser
2. Open Developer Tools → Network tab
3. Reload the page and inspect any request to `hoyolab.com`
4. Copy the full `Cookie` header value (must include `ltuid_v2` and `ltoken_v2`)

`GENSHIN_SERVER` accepts: `os_usa`, `os_euro`, `os_asia`, `os_cht` — pick the one matching your in-game server.


## Running the bot

```bash
node index.js
```

If everything is configured correctly, you'll see:

```
[Widget] Running! Open it in OBS via: http://localhost:3000
[Discord] Logged in as: YourBot#0000
[Auto] Updated successfully — HH:MM:SS
```

## Using the widget in OBS

1. Add a **Browser Source** in OBS
2. Set the URL to `http://localhost:3000`
3. Set width/height to match the widget (around 400px wide)
4. The widget updates live via Firebase — no need to refresh manually

## Discord commands

| Command | Description |
|---|---|
| `!update_widget` | Manually fetch fresh stats and update both Firebase and the Discord profile widget |

## Running with PM2 (recommended for long-term hosting)

```bash
npm install -g pm2
pm2 start index.js --name genshin-widget
pm2 save
pm2 startup
```

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| Cookie expired or invalid | HoYoLAB cookie is stale | Log in again and grab a fresh cookie |
| Account is private or UID is wrong | Genshin profile isn't public, or UID is incorrect | Make your HoYoLAB profile public, double-check the UID |
| Discord Widget PATCH failed | Wrong App ID / User ID / Token, or widget not configured in the Developer Portal | Verify your `.env` values and widget field names match the Developer Portal exactly |
