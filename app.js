const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const cfg = JSON.parse(fs.readFileSync(__dirname+'/config.json'));
const exec = require('child_process').exec;
const Rcon = require('rcon');
const rconClient = new Rcon(cfg.rcon.host, cfg.rcon.port, cfg.rcon.password);
const embedAlert = (name, description, color, time, userIcon, fields = []) =>{
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
    resolve(stdout? stdout : stderr);
   });
  });
}

const isServerOpen = async() =>{
  const result = await execShellCommand('netstat -anltp|grep :'+cfg.mcPort);
  return (result.indexOf(":"+cfg.mcPort) !== -1)
}

const isServerBooting = async() =>{
  const result = await execShellCommand('sudo screen -ls | grep mcserver');
  return (result.indexOf("mcserver") !== -1)
}

const setSUBUTANIPresence = (stat) =>{
  if(stat == "ONLINE"){
    client.user.setPresence({
      status: "online",
      activity: {
          name: "鯖はオンラインです",
          type: "STREAMING" //PLAYING: WATCHING: LISTENING: STREAMING:
      }
    });
  }else{
    if(stat == "OFFLINE"){
      client.user.setPresence({
        status: "dnd",
        activity: {
            name: "鯖はオフラインです",
            type: "LISTENING"
        }
      });
    }else{
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



client.on('ready', async() => {
  console.log(`Logged in as ${client.user.tag}!`);
  let prevStat = await "OFFLINE";
  setSUBUTANIPresence(prevStat);
  let stat;
  while(true){
    stat = await isServerOpen() ? "ONLINE" : "OFFLINE";
    if((stat == "OFFLINE")&&(await isServerBooting())) stat = await "BOOTING";
    if(stat != prevStat){
      console.log("Status changed");
      await setSUBUTANIPresence(stat);
      prevStat = await stat;
      if(stat == "ONLINE"){
        rconClient.connect();
        rconClient.on('auth', function() {
          console.log("Authed!");
        }).on('response', function(str) {
          console.log("Got response: " + str);
        }).on('end', function() {
          console.log("Socket closed!");
          process.exit();
        });
      }
    }
    await sleep(3000);
  }
});

client.on('message', async(msg) => {
  if (msg.content === '!subutani') {
    let status;
    let color;
    let member = "鯖はまだオフラインです";
    const IP = await execShellCommand('curl inet-ip.info');
    if(await isServerOpen()){
      status = await "OPEN"
      color = 65280
      await rconClient.send("list");
      member = await new Promise((resolve, reject) => {
        rconClient.on("response", (str) => {
          resolve(str);
        })
      });
      msg.channel.send(member);
    }else{
      if(await isServerBooting()){
        status = await "BOOTING"
        color = 16098851
      }else{
        status = await "CLOSE"
        color = 16711680
      }
    }
    const url = "https://i.ytimg.com/vi/nS61U_K1YNU/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLD_6QvbKGh-W069AZAPxvPd8dI9tQ"
    const fields =[
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
        "value": "```作る予定(めんどい)```"
      }
    ]
    const embed = embedAlert("SUBUTANI SEXY SERVER", "マイクラ鯖のステータスです", color , new Date(), url, fields );
    msg.channel.send({embed});
  }
  if(msg.content === '!boot subutani'){
    if(msg.guild.roles.cache.find(role => role.name == cfg.roleName).members.get(msg.author.id) !== undefined){
      if((await isServerOpen())||(await isServerBooting())){
        msg.channel.send("```エラー: すでに起動しています```");
      }else{
        exec(cfg.bootCommand, (err, stdout, stderr) => {
          if (err) {
            console.log(`stderr: ${stderr}`)
            return
          }
          console.log(`stdout: ${stdout}`)
        }
      )
        msg.channel.send("```起動を受け付けました。(起動するかどうかは保証されません😇)```");
      }
    }else{
      msg.channel.send("```エラー: 権限がありません```");
    }
  }
});

client.login(cfg.token);