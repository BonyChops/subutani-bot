const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const cfg = JSON.parse(fs.readFileSync(__dirname+'/config.json'));

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
  const exec = require('child_process').exec;
  return new Promise((resolve, reject) => {
   exec(cmd, (error, stdout, stderr) => {
    if (error) {
     console.warn(error);
    }
    resolve(stdout? stdout : stderr);
   });
  });
}

const isServerOpen = async() =>{
  const result = await execShellCommand('netstat -anltp|grep :'+cfg.mcPort);
  return (result.indexOf(":"+cfg.mcPort) !== -1)
}

const setSUBUTANIPresence = (stat) =>{
  if(stat){
    client.user.setPresence({
      status: "online",
      activity: {
          name: "鯖はオンラインです",
          type: "STREAMING" //PLAYING: WATCHING: LISTENING: STREAMING:
      }
    });
  }else{
    client.user.setPresence({
      status: "dnd",
      activity: {
          name: "鯖はオフラインです",
          type: "LISTENING"
      }
    });
  }
}

client.on('ready', async() => {
  console.log(`Logged in as ${client.user.tag}!`);
  let prevStat = await false;
  setSUBUTANIPresence(prevStat);
  let stat;
  while(true){
    stat = await isServerOpen();
    if(stat != prevStat){
      console.log("Status changed");
      await setSUBUTANIPresence(stat);
      prevStat = await stat;
    }
    await sleep(3000);
  }
});

client.on('message', async(msg) => {
  if (msg.content === '!subutani') {
    let status;
    let color;
    const IP = await execShellCommand('curl inet-ip.info');
    if(await isServerOpen()){
      status = await "OPEN"
      color = 65280
    }else{
      status = await "CLOSE"
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
  }
  if(msg.content === '!boot subutani'){
    msg.send(`\`\`\`DEBUG INFO\n${JSON.stringify(msg.author.id)} \`\`\``)
    msg.send(`\`\`\`DEBUG INFO\n${JSON.stringify(msg.guild.roles.cache)} \`\`\``)
    msg.send(`\`\`\`DEBUG INFO\n${JSON.stringify(msg.guild.roles.cache.find(role => role.name == cfg.roleName).get(msg.author.id))} \`\`\``)

  }
});

client.login(cfg.token);