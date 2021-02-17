const express = require('express');
const app = express();
const moment = require('moment');
require('moment-timezone');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json'));
const serverInfo = config.serverInfo;
const discordOAuth = config.discordOAuth;
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();
const port = process.env.PORT || 4649;
const bodyParser = require('body-parser');
const cors = require('cors');
const request = require("request");
const cron = require("node-cron");
//const { rejects } = require('assert');
//const { resolve } = require('path');
const { v4 } = require('uuid');
const { resolve } = require('path');
app.use(bodyParser.json());
const sleep = (ms) => { return new Promise((resolve => { setTimeout(() => { resolve(); }, ms); })) }

class dataBaseAccessToken {
    dataBase = [];
    dataPath;
    constructor(dataPath) {
        this.dataPath = dataPath;
        if (fs.existsSync(dataPath)) {
            this.loadData();
        } else {
            fs.writeFileSync(this.dataPath, JSON.stringify(this.dataBase, null, 2));
        }
    };

    loadData = () => {
        this.dataBase = JSON.parse(fs.readFileSync(this.dataPath));
    }

    writeData = (data = false) => {
        if (data !== false) {
            this.dataBase.push(data);
        }
        fs.writeFileSync(this.dataPath, JSON.stringify(this.dataBase, null, 2));
    }

    findBy = (key, value) => {
        return this.dataBase.find(data => data[key] === value);
    }

    removeBy = (key, value) => {
        this.dataBase = this.dataBase.filter(data => data[key] !== value);
        this.writeData();
    }
}

const db = new dataBaseAccessToken("./data.json");
const bufDb = new dataBaseAccessToken("./buf.json");
const whitelistDb = new dataBaseAccessToken(config.whitelistJsonPath);

const updateWhitelist = async () => {
    whitelistDb.dataBase = db.dataBase.map(data => {
        const uuidBuf = data.mojangData.id;
        const uuid = ([uuidBuf.substr(0,8), uuidBuf.substr(8, 4), uuidBuf.substr(12, 4), uuidBuf.substr(16, 4), uuidBuf.substr(20)]).join("-");
        return {
            name: data.mojangData.name,
            uuid
        }
    });
    whitelistDb.writeData();
    if (await global.isServerOpen()) {
        await global.whitelistUpdate();
    }
}

const returnError = (res, error = false, errorDetail, errorStatus = 400) => {
    console.log("error");
    console.log(error);
    res.status(errorStatus);
    res.json(errorDetail);
}

/* app.listen(port, async () => {
    console.log(`listening on ${port}`);
    console.log("UUID test:" + v4());
    bufDb.dataBase = bufDb.dataBase.filter(data => moment(data.expired_at) > moment());
    bufDb.writeData();
    updateWhitelist();
}); */

server = https.createServer({
    key: fs.readFileSync('./pem/privkey.pem'),
    cert: fs.readFileSync('./pem/fullchain.pem'),
}, app);

server.listen(443, function() {
    process.setuid && process.setuid('node');
    console.log(`user was replaced to uid: ${process.getuid()} ('node')`);
    console.log('example app listening on port 443!');
});


//app.set('port', (process.env.PORT || 443));


app.use(cors());
app.options('*', cors());  // enable pre-flight


app.get("/serverStatus", async (req, res, next) => {
    res.json({
        status: "connected",
        serverInfo,
        guild_name: discordOAuth.approved_server_name,
        oauth: [
            {
                type: "discord",
                client_id: config.discordOAuth.clientId,
                redirect_uri: config.discordOAuth.redirectUri,
                scope: config.discordOAuth.scope
            }
        ]
    });
    console.log("Server connected");
});

app.post("/mojangOAuth", async (req, res, next) => {
    const response = await req.body;
    req.headers.authorization
    const data = bufDb.findBy("access_token", req.headers.authorization);
    if (data === undefined || req.headers.authorization === undefined) {
        returnError(res, false, {
            "status": "error",
            "type": "access_token_invalid"
        })
        next();
        return;
    }
    if (moment(data.expired_at) < moment()) {
        returnError(res, "false", {
            "status": "error",
            "type": "access_token_expired",
            "mes": "This token is already expired at " + data.expired_at
        })
        next();
        return;
    }

    const oauthType = response.oauth_type;
    const oauthTypeDefine = {
        id: async () => {
            if (response.mojangOAuth.id === undefined) {
                returnError(res, "false", {
                    "status": "error",
                    "type": "id_not_provided",
                    "mes": "Wrong format."
                })
                next();
                return;
            }
            const mojangData = await new Promise((resolve, reject) => request("https://api.mojang.com/users/profiles/minecraft/" + response.mojangOAuth.id, (error, response, body) => {
                if (error) {
                    reject(error);
                }
                resolve(response);
            }));
            if (mojangData.statusCode !== 200) {
                returnError(res, "false", {
                    "status": "error",
                    "type": "user_not_found",
                    "mes": `Can't find user name ${response.mojangOAuth.id}`
                })
                return false;
            }
            const prevData = db.findBy("id", data.id);
            const resData = (prevData === undefined) ? {
                status: "ok",
                updated: 0,
                oauthType,
                mojangData: JSON.parse(mojangData.body),
                id: data.id,
                userInfo: data.userInfo,
                created: moment().format()
            } : {
                    status: "ok",
                    updated: prevData.updated + 1,
                    oauthType,
                    mojangData: JSON.parse(mojangData.body),
                    id: data.id,
                    userInfo: data.userInfo,
                    created: moment().format()
                }
            db.removeBy("id", data.id);
            db.writeData(resData);
            res.json(resData);
        }
    }
    if (oauthTypeDefine[oauthType] === undefined) {
        returnError(res, "false", {
            "status": "error",
            "type": "oauth_type not exist",
            "mes": "Wrong format."
        })
        next();
        return;
    }
    if (await oauthTypeDefine[oauthType]() === false) {
        return;
    }
    bufDb.removeBy("access_token", req.headers.authorization);
    updateWhitelist();
    next();
    return;
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
            id: userInfo.id,
            userInfo,
            access_token,
            expired_at: moment().add(10, "minutes").format()
        }
        bufDb.writeData(data);
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

cron.schedule("0 0 * * *", () => {
    bufDb.dataBase = bufDb.dataBase.filter(data => moment(data.expired_at) > moment());
    bufDb.writeData();
})
