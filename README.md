# minion_chatbot
nodejs webapp leveraging OpenAI's ChatGPT-4 model, Redis for session storage, and OAuth2 security pointed at a Mastodon server.

## Dependencies
linux server with the following

1. NodeJS
2. ExpressJS
3. Mastodon API Key
4. Redis
5. OpenAI API Key


## Setup

`git clone https://github.com/technomystics-org/minion_chatbot`

`cd minion_chatbot`

Modify `.env.example` and enter your information:

```
OPENAI_API_KEY=""
APP_SESSION_SECRET=""
MASTODON_CLIENT_ID=""
MASTODON_CLIENT_SECRET=""
REDIS_PASSWORD=""
```

Save modified `.env.example` as `.env`

## Run

`node app.js`

Browse to `http://localhost:5000`


![screenshot](https://github.com/TechnoMystics-org/minion_chatbot/raw/main/docs/images/scrot04-01-2023.png)
