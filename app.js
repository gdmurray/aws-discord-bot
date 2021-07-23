const Discord = require("discord.js")
const client = new Discord.Client()
const AWS = require("aws-sdk")

const RelativeTime = require("dayjs/plugin/relativeTime")
const dayjs = require("dayjs")

dayjs.extend(RelativeTime);


AWS.config.update({
    region: "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const ec2 = new AWS.EC2({apiVersion: "2016-11-15"})
const EC2_INSTANCE = process.env.INSTANCE_ID;
const prefix = process.env.PREFIX;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ALLOWED_USERS = process.env.AUTHOR_IDS.split(",")
const hourly_cost = 1.204

client.on("ready", () => {
    console.log("Bot has started...");
})

const params = {
    DryRun: false,
    InstanceIds: [EC2_INSTANCE]
}

function startServer(message) {
    message.channel.send("[MOCK] Starting Production Server...")
    ec2.startInstances(params, function (err, data) {
        if (err) {
            console.log("Error", err.stack);
            message.channel.send(`Error Checking Status: ${err.message}`)
        } else if (data) {
            message.channel.send(JSON.stringify(data))
            message.channel.send("[MOCK] Production server started at [IP]")
        }
    })
}

function shutDownServer(message) {
    message.channel.send("[MOCK] Shutting down instance...")
    ec2.stopInstances(params, function (err, data) {
        if (err) {
            console.log("Error", err.stack);
            message.channel.send(`Error Stopping Instance: ${err.message}`)
        } else if (data) {
            console.log("Stopped")
            console.log(data)
            message.channel.send(JSON.stringify(data))
        }
    })
}

async function getStatus(message) {
    message.channel.send(`Checking Server Status...`)
    await ec2.describeInstances(params, function (err, data) {
        if (err) {
            message.channel.send(`Error Fetching Information: ${err.message}`)
        } else if (data) {
            const instanceData = data.Reservations[0].Instances.filter((elem) => elem.InstanceId === EC2_INSTANCE)[0];
            const timeUp = dayjs(instanceData.LaunchTime).diff(dayjs(), 'minutes');
            const totalCost = (hourly_cost * timeUp) / 60
            const statusMsg = new Discord.MessageEmbed()
                .setTitle("Stream Server Status")
                .addFields(
                    {name: "State", value: instanceData.State.Name},
                    {name: "Instance Type", value: instanceData.InstanceType},
                    {name: "Zone", value: instanceData.Placement.AvailabilityZone},
                    {name: "Started", value: instanceData.LaunchTime},
                    {name: "Uptime", value: `${dayjs(instanceData.LaunchTime).fromNow()} | $${totalCost}`},
                    {name: "Address", value: instanceData.PublicIpAddress}
                )
            message.channel.send(statusMsg)
        }
    })


}

client.on("message", async message => {
    if (message.author.bot) return;

    if (message.content.indexOf(prefix) !== 0) return;

    if (message.channel.id !== CHANNEL_ID) {
        message.channel.send(`HEY, YOU CANT DO THAT HERE! Please go to <#${CHANNEL_ID}>`)
        return;
    }

    if (ALLOWED_USERS.indexOf(message.author.id) === -1) {
        const msg = new Discord.MessageEmbed()
            .setTitle("Cool kids allowed only")
            .setImage("https://tenor.com/bESVL.gif")
        message.channel.send(msg)
        return;

    }

    const command = message.content.replace(prefix, "").trim()

    if (command === "start") {
        startServer(message)
    }

    if (command === "stop") {
        let messageFilter = m => m.author.id === message.author.id
        message.channel.send("[MOCK] Are you sure you want to shut down the server? Respond (yes/no)? [PS. It saves money]")
        message.channel.awaitMessages(messageFilter, {
            max: 1,
            time: 30000,
            errors: ['time']
        }).then(response => {
            const msg = response.first();
            if (msg.content.toLowerCase() === "yes") {
                shutDownServer(message)
            } else if (msg.content.toLowerCase() === "no") {
                message.channel.send("[MOCK] Cancelled Shutdown")
            } else {
                message.channel.send("[MOCK] Invalid Response")
            }
        }).catch(collected => {
            message.channel.send("Timeout")
        })
    }

    if (command === "status") {
        getStatus(message)
    }

    if (command === "describe") {
        describe(message)
    }
})

client.login(process.env.TOKEN)
