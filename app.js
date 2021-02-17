const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const cfg = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
const exec = require('child_process').exec;
const Rcon = require('rcon');
global.rconClient = new Rcon(cfg.rcon.host, cfg.rcon.port, cfg.rcon.password);

const sendCommand = (cmd) => {
  rconClient.send(cmd);
  return new Promise((resolve, reject) => {
    rconClient.on("response", (str) => {
      resolve(str);
    })
  });
}

const embedAlert = (name, description, color, time, userIcon, fields = []) => {
  return {
    "title": name,
    "description": description,
    "color": color,
    "timestamp": time,
    "thumbnail": {
      "url": userIcon
    },
    "fields": fields
  };
};

function execShellCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve(stdout ? stdout : stderr);
    });
  });
}

const execNormal = (cmd) => {
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.log(`stderr: ${stderr}`)
      return
    }
    console.log(`stdout: ${stdout}`)
  })
}

global.whitelistUpdate = async() => {
  return await rconClient.send("whitelist reload");

}

global.isServerOpen = async () => {
  const result = await execShellCommand('nc -zvw3 localhost ' + cfg.rcon.port);
  return (result.indexOf("Connection refused") === -1)
}

const isServerBooting = async () => {
  const result = await execShellCommand('screen -ls | grep mcserver');
  return (result.indexOf("mcserver") !== -1)
}

const waitTilEnd = async () => {
  await rconClient.send("stop");
  for (let i = 0; i < 5; i++) {
    if (!isServerBooting()) return true;
    await sleep(3000);
  }
  return false;
}

const setSUBUTANIPresence = (stat) => {
  if (stat == "ONLINE") {
    client.user.setPresence({
      status: "online",
      activity: {
        name: "鯖はオンラインです",
        type: "STREAMING" //PLAYING: WATCHING: LISTENING: STREAMING:
      }
    });
  } else {
    if (stat == "OFFLINE") {
      client.user.setPresence({
        status: "dnd",
        activity: {
          name: "鯖はオフラインです",
          type: "LISTENING"
        }
      });
    } else {
      client.user.setPresence({
        status: "idle",
        activity: {
          name: "鯖は起動中です",
          type: "LISTENING"
        }
      });
    }
  }
}



client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  let prevStat = await "OFFLINE";
  setSUBUTANIPresence(prevStat);
  let stat;
  while (true) {
    stat = await isServerOpen() ? "ONLINE" : "OFFLINE";
    if ((stat == "OFFLINE") && (await isServerBooting())) stat = await "BOOTING";
    if (stat != prevStat) {
      console.log("Status changed");
      await setSUBUTANIPresence(stat);
      prevStat = await stat;
      if (stat == "ONLINE") {
        let connected = false;
        while ((!connected) && (await isServerOpen())) {
          console.log("Logging in...");
          rconClient.connect();
          connected = true;
          sleep(3000);
        }
        rconClient.on('auth', function () {
          console.log("Authed!");
          connected = true;
        }).on('response', function (str) {
          console.log("Got response: " + str);
        }).on('end', function () {
          console.log("Socket closed!");
        });
      }
    }
    await sleep(3000);
  }
});

client.on('message', async (msg) => {
  if (msg.content === cfg.prefix) {
    let status;
    let color;
    let member = "鯖はまだオフラインです";
    const IP = (cfg.host !== undefined) ? cfg.host + (cfg.mcPort === "25565" ? "" : ":" + cfg.mcPort) : await execShellCommand('curl inet-ip.info');
    if (await isServerOpen()) {
      status = await "OPEN"
      color = 65280
      member = await sendCommand("list")
    } else {
      if (await isServerBooting()) {
        status = await "BOOTING"
        color = 16098851
      } else {
        status = await "CLOSE"
        color = 16711680
      }
    }
    const url = "https://i.ytimg.com/vi/nS61U_K1YNU/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLD_6QvbKGh-W069AZAPxvPd8dI9tQ"
    const fields = [
      {
        "name": "ステータス",
        "value": status
      },
      {
        "name": "鯖IP",
        "value": `\`${IP}\``
      },
      {
        "name": "遊んでるメンバー",
        "value": `\`\`\`${member}\`\`\``
      },
      {
        name: "サーバーに参加する",
        value: `[参加](https://${config.oauthDomain}/?authServer=${config.host})`
      }
    ]
    const embed = embedAlert("SUBUTANI SEXY SERVER", "マイクラ鯖のステータスです", color, new Date(), url, fields);
    msg.channel.send({ embed });
  }
  if (msg.content.indexOf(cfg.prefix + " mgr") !== -1) {
    if (msg.guild.members.cache.find(member => member.id === msg.author.id).permissions.has("ADMINISTRATOR") || msg.guild.roles.cache.find(role => role.name == cfg.roleName).members.get(msg.author.id) !== undefined) {
      if (msg.content == cfg.prefix + "  mgr reboot") {
        if (await isServerOpen()) {
          msg.channel.send("```再起動しています...```");
          if (await !waitTilEnd()) {
            msg.channel.send("```エラー: 鯖の終了に失敗しました```");
          } else {
            execNormal(cfg.bootCommand);
            msg.channel.send("```起動を受け付けました。(起動するかどうかは保証されません😇)```");
          }
        } else {
          msg.channel.send("```エラー: まだオンラインではありません```");
        }
      }
      if (msg.content == cfg.prefix + " mgr shutdown") {
        if (await isServerOpen()) {
          msg.channel.send("```鯖を終了しています...```");
          msg.channel.send(await waitTilEnd() ? "```終了しました```" : "```失敗しました```");
        } else {
          msg.channel.send("```エラー: まだオンラインではありません```");
        }
      }
      if (msg.content == cfg.prefix + " mgr shutdown -f") {
        if (isServerOpen()) {
          msg.channel.send("```強制シャットダウンを行います...```");
          await execShellCommand("sudo screen -X -S mcserver quit");
        } else {
          msg.channel.send("```エラー: まだオンラインではありません```");
        }
      }
      if (msg.content === cfg.prefix + ' mgr boot') {
        if ((await isServerOpen()) || (await isServerBooting())) {
          msg.channel.send("```エラー: すでに起動しています```");
        } else {
          execNormal(cfg.bootCommand);
          msg.channel.send("```起動を受け付けました。(起動するかどうかは保証されません😇)```");
        }
      }
    } else {
      msg.channel.send("```エラー: 権限がありません```");
    }
  }


});

client.login(cfg.token);


require('./src/authServer.js');
