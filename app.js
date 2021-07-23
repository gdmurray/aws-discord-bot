const Discord = require("discord.js")
const client = new Discord.Client()
const AWS = require("aws-sdk")


AWS.config.update({
    region: "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const ec2 = new AWS.EC2({apiVersion: "2016-11-15"})
const EC2_INSTANCE = process.env.INSTANCE;
const prefix = process.env.PREFIX;

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
            message.channel.send(JSON.stringify(data))
        }
    })
}

function getStatus(message) {
    ec2.describeInstanceStatus(params, function (err, data) {
        if (err) {
            console.log("Error", err.stack);
            message.channel.send(`Error Checking Status: ${err.message}`)
        } else if (data) {
            message.channel.send(JSON.stringify(data))
        }
    })
}

client.on("message", async message => {
    if (message.author.bot) return;

    if (message.content.indexOf(prefix) !== 0) return;

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

    }
})

client.login(process.env.TOKEN)
