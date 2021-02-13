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

const sleep = (ms) => { return new Promise((resolve => { setTimeout(() => { resolve(); }, ms); })) }

let bufAccessTokens = [];

class db{
    data = [];
    dataPath;
    constructor(dataPath){
        this.dataPath = dataPath;
        if(fs.existsSync(dataPath)){
            this.loadData();
        }else{

        }
    };

    loadData = () => {
        this.data = JSON.parse(fs.readFileSync(this.dataPath));
    }

    writeData = (data) => {

    }


}

const returnError = (res, error = false, errorDetail) => {
    console.log("error");
    console.log(error);
    res.status(400);
    res.json(errorDetail);
    next();
}

app.listen(port, () => {
    console.log(`listening on ${port}`);
    console.log("UUID test:" + v4());
});

app.use(cors());
app.options('*', cors());  // enable pre-flight

app.get("/serverStatus", async(req, res, next) => {
    res.json({
        status: "connected",
        serverInfo,
        guild_name: discordOAuth.approved_server_name
    });
    console.log("Server connected");
});

app.post("/mojangOAuth", async(req, res, next) => {
    const response = await req.json();
    if(!bufAccessTokens.some(data => data.access_token === req.headers.get("authorization"))){
        returnError(res, error, {
            "status": "error",
            "type": "access_token_invalid",
            "mes": error.toString()
        })
        next();
        return;
    }
    const oauthType = {
        id: () => {

        }
    }
})

app.post("/discordOAuth", async function (req, res, next) {
    console.log("discordOAuth");
    const code = req.body.code;
    if (code === undefined || code === "") {
        returnError(res, error, {
            "status": "error",
            "type": "code_not_provided",
            "mes": error.toString()
        });
        next();
        return;
    }
    console.log(code);
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
        next();
    })

    const userInfo = await new Promise((resolve, reject) => {
        oauth.getUser(access_token).then(data => resolve(data)).catch(e => reject(e));
    }).catch(error => {
        returnError(res, error, {
            "status": "error",
            "type": "no_permission_identify",
            "mes": error.toString()
        })
        next();
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
        next();
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
        console.log(data);
    } else {
        returnError(res, false, {
            "status": "error",
            "type": "no_approved_guild",
            "mes": "Please join to specific Discord server.",
            "guild_name": discordOAuth.approved_server_name
        });
    }
})