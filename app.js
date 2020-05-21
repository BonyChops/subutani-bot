const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const cfg = JSON.parse(fs.readFileSync(__dirname+'/config.json'));

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
  const result = await execShellCommand('sudo netstat -ltup4 -n');
  return (result.indexOf(":"+cfg.mcPort) !== -1)
}

const setSUBUTANIPresence = (stat) =>{
  if(stat){
    client.user.setPresence({
      status: "online",
      activity: {
          name: "鯖はオンラインです",
          type: "LISTENING" //PLAYING: WATCHING: LISTENING: STREAMING:
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
    if(await isServerOpen()){
      msg.reply("オンラインですね");
    }else{
      msg.reply("オフラインですね");
    }

  }
});

client.login(cfg.token);