# subutani-bot
SUBUTANI BOT

# config.json
```json
{
    "token": "discord-token",
    "mcPort": "25565",
    "roleName": "SEXY SERVER MANAGER",
    "bootCommand": "screen -dm -S mcserver sh start.sh",
    "rcon": {
        "host": "localhost",
        "port": "50000",
        "password": "rcon_password"
    },
    "serverInfo":{
        "serverName": "servername",
        "serverOwner": "your-name"
    },
    "discordOAuth": {
        "clientId": "client_id",
        "clientSecret": "client_secret",
        "scope": "identify guilds",
        "redirectUri": "https://auth.mc.nnct18j.com/redirect.html",
        "approved_server": ["approved_discord_server_ids"],
        "approved_server_name": "description_of_server"
    },
    "whitelistJsonPath": "path/to/whitelist.json"
}
```