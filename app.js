const Discord = require("discord.js")
const client = new Discord.Client()
const AWS = require("aws-sdk")

const LocalizedFormat = require("dayjs/plugin/localizedFormat")
const RelativeTime = require("dayjs/plugin/relativeTime")
const dayjs = require("dayjs")

dayjs.extend(RelativeTime);
dayjs.extend(LocalizedFormat);


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
    const msg = new Discord.MessageEmbed()
        .setTitle("Starting Server")
    ec2.startInstances(params, function (err, data) {
        if (err) {
            console.log("Error", err.stack);
            msg.setColor('#F87171')
            msg.setDescription("Error Starting Instance")
            msg.addFields({name: "Code", value: err.code, inline: true}, {
                name: "Message",
                value: err.message,
                inline: true
            })
            message.channel.send(msg)
        } else if (data) {
            msg.setColor("#34D399")
            const instance = data.StartingInstances[0];
            msg.setDescription(`${instance.InstanceId}: ${instance.PreviousState.Name} -> ${instance.CurrentState.Name}`)
            msg.setFooter(`Started: ${dayjs().format('LLL')}`)
            message.channel.send(msg);
        }
    })
}

function shutDownServer(message) {
    const msg = new Discord.MessageEmbed()
        .setTitle("Stopping Server")
    ec2.stopInstances(params, function (err, data) {
        if (err) {
            console.log("Error", err.stack);
            msg.setColor('#F87171')
            msg.setDescription("Error Stopping Instance")
            msg.addFields({name: "Code", value: err.code, inline: true}, {
                name: "Message",
                value: err.message,
                inline: true
            })
            message.channel.send(msg)
        } else if (data) {
            msg.setColor("#FCD34D")
            const instance = data.StoppingInstances[0];
            msg.setDescription(`${instance.InstanceId}: ${instance.PreviousState.Name} -> ${instance.CurrentState.Name}`);
            msg.setFooter(`Stopped: ${dayjs().format('LLL')}`)
            message.channel.send(msg);
        }
    })
}

async function getStatus(message) {
    const msg = new Discord.MessageEmbed()
        .setTitle("Stream Server Status")
    console.log("fetching status")
    ec2.describeInstanceStatus(params, function (statusError, statusData) {
        if (statusError) {
            console.log("Error getting status")
            msg.setColor('#F87171')
            msg.setDescription("Error Getting Status")
            msg.addFields({name: "Code", value: statusError.code, inline: true}, {
                name: "Message",
                value: statusError.message,
                inline: true
            })
            message.channel.send(msg)
            return;
        } else {
            const instance = statusData.InstanceStatuses.filter((elem) => elem.InstanceId === EC2_INSTANCE)[0];
            if (instance) {
                const status = instance.InstanceStatus.Status
                const okayStatuses = ["ok"]
                const warningStatuses = ["insufficient-data", "initializing", "not-applicable"]
                msg.setDescription(`Status: ${status}`)
                if (okayStatuses.indexOf(status) !== -1) {
                    msg.setColor("#34D399")
                } else if (warningStatuses.indexOf(status) !== -1) {
                    msg.setColor("#FCD34D")
                } else {
                    msg.setColor('#F87171')
                }
            } else {
                msg.setDescription(`Status: Could Not Fetch Status`)
                msg.setColor('#F87171')
            }

            console.log("Describing Instance")
            ec2.describeInstances(params, function (err, data) {
                if (err) {
                    msg.setColor('#F87171')
                    msg.setDescription("Error Getting Status")
                    msg.addFields({name: "Code", value: err.code, inline: true}, {
                        name: "Message",
                        value: err.message,
                        inline: true
                    })
                    message.channel.send(msg)
                } else if (data) {
                    console.log("Received Data from describe")
                    const instanceData = data.Reservations[0].Instances.filter((elem) => elem.InstanceId === EC2_INSTANCE)[0];
                    const timeUp = dayjs().diff(dayjs(instanceData.LaunchTime), 'minutes');
                    const totalCost = ((hourly_cost * timeUp) / 60).toFixed(2)
                    msg
                        .addFields(
                            {name: "State", value: instanceData.State.Name, inline: true},
                            {name: "Started", value: dayjs(instanceData.LaunchTime).format("LLL"), inline: true},
                            {
                                name: "Uptime",
                                value: `${dayjs(instanceData.LaunchTime).fromNow()}`,
                                inline: true
                            },
                            {
                                name: "Current Run Cost",
                                value: `$${totalCost}`
                            },
                            {name: "Instance Type", value: instanceData.InstanceType, inline: true},
                            {name: "Zone", value: instanceData.Placement.AvailabilityZone, inline: true},
                            {name: "Address", value: instanceData.PublicIpAddress, inline: true}
                        )
                    msg.setFooter(`Status as of: ${dayjs().format('LLL')}`)
                    message.channel.send(msg)
                }
            })

        }
    });


}

client.on("message", async message => {
    const commands = ["start", "stop", "status", "help"]
    if (message.author.bot) return;

    if (message.content.indexOf(prefix) !== 0) return;

    if (message.channel.id !== CHANNEL_ID) {
        message.channel.send(`Ma'am, this is a Wendy's. Please go to <#${CHANNEL_ID}>`)
        return;
    }

    const command = message.content.replace(prefix, "").trim()
    if (commands.indexOf(command) === -1) {
        const notRecognized = new Discord.MessageEmbed()
            .setColor('#F87171')
            .setTitle(`Not a Recognized Command: ${command}`)
            .setDescription("Type !server help for list of commands")
        message.channel.send(notRecognized)
        return
    }
    if (command === "help") {
        const helpMsg = new Discord.MessageEmbed()
            .setTitle("Streaming Server Control Bot")
            .setColor("#34D399")
            .setDescription(`The scope of this bot is limited to <#${CHANNEL_ID}> only.`)
            .setFooter("The * on the commands indicate only specified users can access it")
            .addField("Help", "This command")
            .addField("Start*", "Starts the server")
            .addField("Stop*", "Stops the server")
            .addField("Status", "Describes the status of the server")
        message.channel.send(helpMsg)
        return
    }

    if (command === "status") {
        getStatus(message)
    }

    if (ALLOWED_USERS.indexOf(message.author.id) === -1) {
        message.channel.send("https://tenor.com/bESVL.gif")
        return;
    }

    if (command === "start") {
        startServer(message)
    }

    if (command === "stop") {
        let messageFilter = m => m.author.id === message.author.id
        const confirmMessage = new Discord.MessageEmbed()
            .setColor("#FCD34D")
            .setTitle("Are you sure you want to shut down the server?")
            .setDescription("Respond **yes** or **no**")
            .setFooter("It is not cheap so please shut down after use")
        message.channel.send(confirmMessage)
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
})

client.login(process.env.TOKEN)
