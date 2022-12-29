type User = {
    id: number
    discriminator: string
    name: string
    bot: boolean
}
type Guild = {
    id: number
    channels: Channel[]
    users: User[]
}
type Channel = {
    id: number
    name: string
}
type EventMessage = {
    author: User
    channel: Channel
    guild: Guild
    content: string;
    id:number
}
import DB from '@agacraft/http/DB';
const _db = new DB()
type DataBase = typeof _db
type EventData = {
    event: 'message';
    args: [DBMessage, number, number]
}
interface DBServer {
    name: string
    channels: { id: number }[]
    users: { id: number }[] | DBUser[] | 'ALL'
    id: number
    publicId: number
}
interface DBChannel {
    name: string
    id: number
    serverId:number
    publicId: number
    messages: DBMessage[]
}
interface DBUser {
    name: string,
    email: string,
    password: string,
    bot: boolean,
    publicId: number,
    discriminator: string,
    id: number
}
interface DBMessage{
    id:number,
    content:string,
    userId:number
}

export = function Api(db: DataBase) {
    function getUser(id: number) {
        const user = db.getItem('users', id) as DBUser
        let User: User = {
            id: user.publicId,
            discriminator: user.discriminator,
            name: atob(user.name),
            bot: user.bot
        }
        return User
    }
    function getChannel(id: number) {
        const channel = db.getItem('channels', id) as DBChannel
        let Channel: Channel = {
            id: channel.publicId,
            name: channel.name,
        }
        return Channel
    }
    function getGuild(id: number) {
        const server = {...db.getItem('servers', id)} as DBServer;
        let Guild: Guild = {
            channels: [],
            id: server.publicId,
            users: [],
        }
        if(server.users === 'ALL')db.get('users').forEach(user=> Guild.users.push(getUser(user.id)))
        else server.users.forEach(user=> Guild.users.push(getUser(user.id)))
        server.channels.forEach(channel => Guild.channels.push(getChannel(channel.id)))
        return Guild
    }
    return function eventApi(event: EventData) {
        if (event.event === 'message') {
            const [message, channelId, serverId] = event.args;
            if(!message)return {} as EventMessage;
            const guild = getGuild(serverId)
            const channel = getChannel(channelId)
            const author = getUser(message.userId)
            let EventMessage: EventMessage = {
                author,
                channel,
                guild,
                id: message.id,
                content: JSON.parse(atob(message.content)),
            }
            return EventMessage
        }
    }
}