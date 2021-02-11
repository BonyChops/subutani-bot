const express = require('express');
const app = express();
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json'));
const serverInfo = config.serverInfo;
const discordOAuth = config.discordOAuth;
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();
const port = process.env.PORT || 30000;
const bodyParser = require('body-parser');
const cors = require('cors');
const { rejects } = require('assert');
const { resolve } = require('path');
const { v4 } = require('uuid');
app.use(bodyParser.json());

let bufAccessTokens = [];

const returnError = (res, error = false, errorDetail) => {
    console.log("error");
    console.log(error);
    res.status(400);
    res.json(errorDetail);
    return;
}

app.listen(port, () => {
    console.log(`listening on ${port}`);
    console.log(v4());
});

app.use(cors());
app.options('*', cors());  // enable pre-flight

app.get("/serverStatus", function (req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({
        status: "connected",
        serverInfo
    });
});

app.post("/discordOAuth", async function (req, res, next) {
    const code = req.body.code;
    const access_token = await new Promise((resolve, reject) => {
        oauth.tokenRequest({
            clientId: discordOAuth.clientId,
            clientSecret: discordOAuth.clientSecret,
            code,
            scope: discordOAuth.scope,
            grantType: "authorization_code",
            redirectUri: discordOAuth.redirectUri,
        }).then(data => resolve(data.access_token)).catch(e => {
            console.log("Dead");
            reject(e);
        });
    }).catch((error) => {
        returnError(res, error, {
            "status": "error",
            "type": "not_authorized",
            "mes": error.toString()
        });
        return;
    })

    const userInfo = await new Promise((resolve, reject) => {
        oauth.getUser(access_token).then(data => resolve(data)).catch(e => reject(e));
    }).catch(error => {
        returnError(res, error, {
            "status": "error",
            "type": "no_permission_identify",
            "mes": error.toString()
        })
        return;
    });
    console.log(userInfo);

    const guilds = await new Promise((resolve, reject) => {
        oauth.getUserGuilds(access_token).then(data => resolve(data)).catch(e => reject(e));
    }).catch(error => {
        returnError(res, error, {
            "status": "error",
            "type": "no_permission_guild",
            "mes": error.toString()
        })
        return;
    });
    if (guilds.some(guild => discordOAuth.approved_server.includes(guild.id))) {
        const access_token = v4();
        const data = {
            status: "ok",
            userInfo,
            access_token
        }
        bufAccessTokens.push(data);
        res.json(data);
    }else{
        returnError(res, false, {
            "status": "error",
            "type": "no_approved_guild",
            "mes": "Please join to specific Discord server.",
            "guild_name": discordOAuth.approved_server_name
        });
    }
})