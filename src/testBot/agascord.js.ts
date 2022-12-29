import { WebSocket } from 'ws';
import fetch from '@agacraft/http/request';

const host = 'localhost:3001'

//#region 

type Data = {
    event: 'message';
    args: [EventMessage]
} | {
    event: 'messageDeleted',
    args: [EventMessage]
} | {
    event: 'login',
    args: [{
        token: string; login: boolean
    }]
}

type Color =
    | 'RANDOM'
    | [number, number, number]
    | string;

interface EmbedFieldData {
    name: string;
    value: string;
    inline?: boolean;
}

type EmbedConfig = {
    title?: string
    description?: string;
    timestamp?: Date | number;
    color?: Color;
    fields?: EmbedFieldData[];
}

type MessageType = { reply: string } & ({
    type: 'EMBED',
    content: EmbedConfig
} | {
    type: 'TEXT',
    content: string
})

//#endregion

//#region

type UserArgs = { id: number, discriminator: string, name: string, bot: boolean, verified: boolean, image: string }
export class User {
    id: number
    discriminator: string
    name: string
    bot: boolean
    verified: boolean
    #image: string
    static fromId(client: Client, id: number) {
        return new Promise(async res => {
            let data = await fetch(`http://${host}/api/user/${id}`, { method: 'POST', body: JSON.stringify({ token: client.token }) })
            let user = await data.json()
            res(new User(user as UserArgs))
        })
    }
    constructor(info: UserArgs) {
        this.id = info.id
        this.discriminator = info.discriminator
        this.name = info.name
        this.bot = info.bot
        this.verified = info.verified
        this.#image = info.image
    }
    displayAvatarURL() {
        return this.#image
    }
    async displayAvatarBuffer() {
        const res = await fetch(this.#image);
        return res.buffer();
    }

    toString() {
        return `<@${this.id}>`
    }
}

export type GuildArgs = { id: number, channels: ChannelArgs[], users: UserArgs[] }

export class Guild {
    id: number
    channels: Channel[]
    users: User[]
    constructor(public client: Client, info: GuildArgs) {
        this.id = info.id
        this.users = info.users.map(user => new User(user))
        this.channels = info.channels.map(info => new Channel(this.client, { id: info.id, guild: this, name: info.name }))
    }
    channelFromId(id: number) {
        return this.channels.find(channel => channel.id === id)
    }
    channelFromName(name: string) {
        return this.channels.find(channel => channel.name === name)
    }
}

export type ChannelArgs = { id: number, name: string }

export class Channel {
    id: number
    name: string
    guild: Guild
    users: User[]
    constructor(public client: Client, info: ChannelArgs & { guild: Guild }) {
        this.id = info.id
        this.name = info.name
        this.guild = info.guild
        this.users = this.guild.users
    }
    send(...args: (string | Embed | [string | Embed, Message])[]) {
        return this.client._sendMessage(this.guild.id, this.id, ...args)
    }
    fetch(count: number) {
        return fetch(`http://${host}/api/messages`, { method: 'POST', body: JSON.stringify({ author: globalThis.token, messages: count, serverId: this.guild.id, channelId: this.id }) })
            .then(msg => (msg.json() as EventMessage[]).map(message => this.client._parseMessage(message)).filter(Boolean)) as Promise<Message[]>
    }
    bulkDelete(count: number) {
        return this.client._bulkDelete(count, this)
    }
}

type MessageInfo = { author: User, guild: Guild, channelId: number, content: MessageType, deleted: boolean, id: number }

export class Message {
    guild: Guild
    channel: Channel
    content: string
    deleted: boolean
    author: User
    id: number

    static fromId(client: Client, channel:number, id:number){
        return new Promise(async res=>{
            let data = await fetch(`http://${host}/api/message/${id}`, {method:'POST', body:JSON.stringify({channel, token:client.token})})
            let info = data.json() as MessageInfo;
            res(new Message(client, info))
        })
    }
    constructor(public client: Client, info: MessageInfo) {
        this.deleted = !!info.deleted
        if(!info || this.deleted)return;
        this.guild = info.guild
        this.channel = this.guild.channels.find(channel => channel.id == info.channelId)
        this.id = info.id
        this.author = info.author

        if (info.content.type == 'TEXT')
            this.content = (info.content.content || '').trim()
        else if (info.content.type == 'EMBED')
            this.content = (info.content.content.title || info.content.content.description || '').trim()
        else this.content = ''
    }
    delete(config = {} as { timeout: number }) {
        setTimeout(() => this.client.emit('api/message/delete', this.id, this.channel.id, this.guild.id, this.client.token),
            config?.timeout || 1
        )
        return this
    }
    reply(data: string | Embed) {
        return this.channel.send([data, this])
    }
    toString() {
        return `<M#${this.id}>`
    }
}
//#endregion

export class Embed {
    type = 'EMBED' as 'EMBED'
    title = ''
    description = ''
    timestamp = 0
    color: Color = 'RANDOM'
    fields: EmbedFieldData[] = []
    constructor(data: Embed | EmbedConfig) {
        if (data.color) this.setColor(data.color)
        if (data.description) this.setDescription(data.description)
        if (data.fields) this.setFields(data.fields)
        if (data.timestamp) this.setTimestamp(data.timestamp)
        if (data.title) this.setTitle(data.title)
    }
    setTitle(title: string) {
        this.title = title
        return this;
    }
    setDescription(description: string) {
        this.description = description
        return this;
    }
    setTimestamp(timestamp: Date | number) {
        let date = timestamp || Date.now();
        if (date instanceof Date) {
            date = timestamp.valueOf()
        }
        this.timestamp = date
        return this;
    }
    setColor(color: Color) {
        this.color = color
        return this;
    }
    setField(field: EmbedFieldData) {
        this.fields.push(field)
        return this
    }
    setFields(fields: EmbedFieldData[]) {
        fields.forEach(field => {
            this.fields.push(field)
        })
        return this
    }
    toMessage() {
        return {
            title: this.title,
            description: this.description,
            timestamp: this.timestamp,
            color: this.color,
            fields: this.fields
        }
    }
}

export type events = {
    message: [Message];
    messageDeleted: [Message];
    login: [User];
}
export type EventMessage = {
    guild: GuildArgs,
    channel: ChannelArgs,
    content: MessageType,
    deleted: boolean,
    id: number,
    author: UserArgs
}
export class Client{
    #socket:WebSocket = null;
    #events = new Map();
    #token = ''
    user: User;
    on<E extends keyof events>(event: E, callback: (...args: events[E]) => void) {
        if (!this.#events.has(event)) {
            this.#events.set(event, new Set());
        }
        this.#events.get(event).add(callback);
        return this
    }
    emit(event: string, ...args: any[]) {
        this.#socket.send(
            JSON.stringify({ event, args: [...args] })
        );
        return this
    }
    async listen(token: string, callback?: Function) {
        this.#token = token
        let data = await fetch(`http://${host}/api/user/${this.#token}`)
        this.#socket = new WebSocket(`ws://${host}`)
        let user = data.json()
        this.user = new User(user as any)
        this.#socket.on('message', event => {
            const data = JSON.parse(event.toString()) as Data;
            if (!data.event.startsWith('api/')) return;
            else data.event = data.event.replace('api/', '') as Data['event']
            let args = [] as unknown as events[typeof data.event]

            if (data.event === 'message' || data.event === 'messageDeleted') {
                if (data.args[0].guild)
                    args[0] = this._parseMessage(data.args[0])
            }
            if (data.event === 'login' && data.args[0].token == token) {
                if (!data.args[0].login) throw new Error('Invalid token')
                args[0] = this.user
            }

            if (this.#events.has(data.event)) {
                this.#events.get(data.event).forEach((fn: Function) => fn(...args));
            }
        })
        this.#socket.on('error', console.log)
        this.#socket.on('open', () => {
            callback(this)
            this.emit('api/login', token)
        })
        return this
    }
    get token(){
        return this.#token
    }
    _getMessage(message: string | Embed | [string | Embed, Message], reply?:Message | string) {
        if (message instanceof Array) {
            reply = message[1]
            message = message[0]
        }
        if(reply){
            reply = reply.toString()
        }

        let response = { reply } as MessageType

        if (typeof message == 'object') {
            response.type = message.type
            response.content = message.toMessage()
        }
        if (typeof message == 'string') {
            response.type = 'TEXT'
            response.content = message
        }
        return JSON.stringify(response)
    }
    _sendMessage(serverId: number, channelId: number, ...messages: (string | Embed | [string | Embed, Message])[]): Promise<Message | Message[]> {
        return new Promise(async (res, rej) => {
            let messagesPromise = messages.map(message => {
                return fetch(`http://${host}/api/message`, { method: 'POST', body: JSON.stringify({ author: this.token, message:this._getMessage(message), channelId, serverId }) }).then(r => r.json())})
            let messagesValue = (await Promise.allSettled(messagesPromise))
                .map((msg) => (msg as unknown as { value: EventMessage }).value)
                .filter(Boolean).map(message => this._parseMessage(message))
            if (messagesValue[1]) return res(messagesValue)
            res(messagesValue[0])
        })

    }
    _parseMessage(event: EventMessage) {
        if (!event.guild) return
        return new Message(this, {
            guild: new Guild(this, event.guild),
            content: event.content,
            deleted: event.deleted,
            id: event.id,
            channelId: event.channel.id,
            author: new User(event.author)
        });
    }
    _bulkDelete(count: number, channel: Channel): Promise<Message[]> {
        return new Promise(async (resolve, reject) => {
            let messages = await channel.fetch(count);
            messages.forEach(message => {
                message.delete()
                message.deleted = true
            })
            resolve(messages)
        })
    }
}