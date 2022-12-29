import {Client, Embed} from './agascord.js'

console.log('Bot')

let client = new Client()
client.on('message', (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith('/')) {
        message.delete()
        const [cmd, ...args] = message.content.split(' ')
        if (cmd == '/say') message.channel.send(args.join(' '))
        else if (cmd == '/embed') message.channel.send(new Embed({ description: args.join(' '), title: `This is a embed` }))
        else if (cmd == '/clear') message.channel.bulkDelete(Number(args[0]))
        else message.reply('comando no detectado').then(console.log)
    }
})
client.on('messageDeleted', message=>{
    console.log(message)
})
client.listen('1234', (bot) => {
    console.log('ready')
    console.log(bot)
})