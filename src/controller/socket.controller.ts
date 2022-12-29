import DB from '@agacraft/http/DB'
import waga from 'waga';
import ws from 'ws';

import apiController from './api.controller';

const _db = new DB()

interface events {
    online(socket: ws.WebSocket, { serverId, channelId }: { serverId: number, channelId: number }): void;
    connect(socket: ws.WebSocket): void;
    disconnect(): void;

    [key: string]: Function;
}

type IO = {
    on<E extends keyof events>(event: E, callback: events[E]): void;
    emit(event: string, ...args: any[]): void;
    iemit(event: string, ...args: any[]): void;
}

type ServerScord = {
    users: string | { id: number }[],
    channels: {
        publicId: number,
        id: number
    }[],
    publicId: number,
    id: number
}

type user = {
    image: string
    name: string
    email: string
    password: string
    bot: false
    publicId: number;
    discriminator: string
    id: number
    active?: boolean
    verified: boolean
}
type bot = {
    image: string
    name: string
    bot: true
    token: string
    publicId: number;
    discriminator: string
    id: number
    active?: boolean
    verified: boolean
}

type channel = {
    name: string,
    publicId: number,
    id: number,
    serverId: number
}

export = function (server: waga.Server, db: typeof _db): Promise<{
    on<E extends keyof events>(event: E, callback: events[E]): void;
    emit(event: string, ...args: any[]): void;
    iemit(event: string, ...args: any[]): void;
}> {
    function publicIdToId(type: string, publicId: number) {
        return db.get(type).find((value) => value.publicId == publicId)?.id
    }
    function toChannel(channel: channel) {
        return { name: channel.name, id: channel.publicId }
    }
    function toAuthor(user: user) {
        return { name: atob(user.name), verified: !!user.verified, image: user.image || 'https://cdn-icons-png.flaticon.com/512/1946/1946429.png', id: user.publicId, active: !!user.active, descriminator: user.discriminator, bot: user.bot }
    }
    function getAuthor(id: number) {
        const user = db.getItem('users', id) as any
        return toAuthor(user)
    }

    return new Promise(resolve => {
        const socket = io(server);
        const api = apiController(db)

        socket(io => {
            io.on('online', (socket, a) => {
                let { serverId, channelId } = a
                const server = db.getItem('servers', publicIdToId('servers', serverId));
                if (server) {
                    channelId = channelId ? publicIdToId('channels', channelId) : server.channels[0].id
                    let messages = db.getItem('channels', channelId)?.messages as any[]
                    messages.forEach((element) => {
                        let user = getAuthor(element.userId);
                        socket.send(JSON.stringify({ event: `load/message/${serverId}`, args: [user, element.content] }));
                    });
                }
            });
            io.on('new-server', (callback:Function, {userId}: {userId: number}, serverName: string)=>{
                let user = db.getItem('users', publicIdToId('users', userId))
                db.add('servers', {
                    name: serverName,
                    channels: [
                        {
                            "publicId": 1670034596106,
                            "id": 3
                        }
                    ],
                    users: [
                        {
                            id: user.id
                        }
                    ],
                    author: user.id,
                    publicId: Date.now()
                })
            })
            io.on('message', (callback: (message: {
                userId: number;
                content: string;
                id: number;
            }) => void, { serverId, userId, channelId }: { serverId: number, userId: number, channelId: number }, message: string, id: number = Date.now()) => {
                if(!JSON.parse(message)?.content?.trim())return;
                let server = db.getItem('servers', publicIdToId('servers', serverId));
                if (server) {
                   channelId = channelId ? publicIdToId('channels', channelId) : server.channels[0].id
                    let channel = db.getItem('channels', channelId) as {
                        [key: string]: any;
                    };
                    let user = db.getItem('users', publicIdToId('users', userId));
                    let isValidUser = server.users === 'ALL' || server.users.find((User: any) => user.id == User.id);
                    if (user && isValidUser) {
                        let __message__ = {
                            userId:user.id,
                            content: btoa(message),
                            id
                        }
                        channel.messages.push(__message__);
                        callback(__message__ as any)
                        db.edit('channels', channel.id, channel);
                        io.emit(`message/${server.publicId}`, getAuthor(user.id), btoa(message), channel.publicId);

                        apiEvent(io, { serverId:server.id }, 'api/message', api({
                            event: 'message', args: [__message__, channel.id, server.id]
                        }))
                    }
                }
            });
            io.on('api/message/delete', (callback: any, messageId: number, channelId: number, serverId: number, token: string) => {
                let server = db.get('servers').find(server => server.publicId == serverId);
                if (server && server.channels.filter((c: any) => c.publicId == channelId)) {
                    let channel = db.get('channels').find(channel => channel.publicId == channelId) || { messages: [] }
                    const __message__ = channel.messages.find((message: any) => message.id == messageId)
                    channel.messages = channel.messages.filter((message: any) => message.id != messageId)
                    const messages = channel.messages.map((message: any) => ({ content: message.content, author: getAuthor(message.userId) }))
                    apiEvent(io, { serverId: server.id }, 'api/messageDeleted', api({
                        event: 'message', args: [__message__, publicIdToId('channels', channelId), publicIdToId('servers', serverId)]
                    }))
                    db.edit('channels', channel.id, channel)
                    io.iemit(`reload`, { serverId: server.publicId, channelId: channel.publicId }, messages)
                }
            })
            resolve(io)
        });
    })
    function apiEvent(io: IO, { serverId }, event: string, ...args: any[]) {
        let server = db.getItem('servers', serverId) as ServerScord;
        let users: any[];
        if (typeof server.users === 'string' && server.users === 'ALL')
            users = db.get('users')
        else if (typeof server.users == 'object')
            users = server.users.map(user => db.getItem('users', user.id)).filter(user => user.bot)
        users.filter(user => user.bot).forEach(user => {
            io.emit(`api/token/${user.token}`, { event, args })
        })
    }
    function io(server: waga.Server) {
        const sockets = new Map<string, Set<ws.WebSocket>>();
        const members = new Map<string, Set<number>>();
        const events = new Map<string, Set<Function>>();
        const io = new ws.Server({ server });
        let obj = {
            on<E extends keyof events>(event: E, callback: events[E]) {
                if (!events.has(event as string)) {
                    events.set(event as string, new Set());
                }
                events.get(event as string)!.add(callback);
            },
            emit(event: string, ...args: any[]) {
                if (sockets.has(event))
                    sockets.get(event).forEach(socket => {
                        if (event.startsWith('api/token')) socket.send(JSON.stringify(args[0]))
                        else socket.send(JSON.stringify({ event, args: [...args] }));
                    });
            },
            iemit(event: string, ...args: any[]) {
                if (event === 'reload') {
                    let { serverId, channelId } = args[0];
                    if (sockets.has(`message/${serverId}`))
                        sockets.get(`message/${serverId}`)
                            .forEach(socket => socket.send(JSON.stringify({ event: 'reload', args: [args[1]] })))
                } else if (events.has(event as string)) {
                    events.get(event)!.forEach(fn => fn(...args))
                }
            }
        };

        io.on('connection', socket => {
            let serverID = 0;
            let serversId = []
            let isBot = false;
            let channel = ''
            let member = ''
            let userId = 0
            function usersConnected(serverId: number) {
                let server = db.getItem('servers', serverId)
                if(!server)return;
                let users = server.users;
                let serverMembers: (user | bot)[] = [];

                if (users == 'ALL')
                    db.get('users').forEach(user => serverMembers.push(user as user))
                else if (users instanceof Array)
                    users.map(user => db.getItem('users', user.id)).forEach(user => serverMembers.push(user as user))
                serverMembers = JSON.parse(JSON.stringify(serverMembers))
                serverMembers.forEach(user => {
                    user.active = members.get(member).has(user.id)
                })
                let authors = serverMembers.map(toAuthor)

                let Channel = isBot ? `message/${server.publicId}` : channel

                if (sockets.has(Channel)){
                    sockets.get(Channel).forEach(socket => {
                        socket.send(JSON.stringify({ event: 'members', args: [authors] }))
                    })
                }
            }
            function channels(serverId: number) {
                let channels = db.getItem('servers', serverId).channels;
                let serverChannels: channel[] = [];

                channels.map(channel => db.getItem('channels', channel.id)).forEach(channel => serverChannels.push(channel as channel))

                serverChannels = JSON.parse(JSON.stringify(serverChannels))
                let channelsData = serverChannels.map(toChannel)

                if (sockets.has(channel))
                    sockets.get(channel).forEach(socket => {
                        socket.send(JSON.stringify({ event: 'channels', args: [channelsData] }))
                    })
            }
            function servers(userId: number) {
                let servers = db.get('servers').map(server => {
                    if (server.users == 'ALL') return server.publicId;
                    if (server.users.find(user => user.id == userId)) return server.publicId;
                }).filter(r => r)
                socket.send(JSON.stringify({ event: 'servers', args: [servers] }))
            }
            if (events.has('connect')) {
                events.get('connect')!.forEach(fn =>
                    fn({
                        emit(event: string, ...args: any[]) {
                            socket.send(JSON.stringify({ event, args: [...args] }));
                        },
                    })
                );
            }
            socket.on('close', () => {
                if (events.has('disconnect')) {
                    events.get('disconnect')!.forEach(fn => fn());
                }
                if (sockets.get(channel))
                    sockets.get(channel).delete(socket);
                if (members.get(member))
                    members.get(member).delete(userId);
                if (isBot)
                    serversId.forEach(server => {
                        member = `member/${server}`
                        if (members.get(member))
                            members.get(member).delete(userId);
                        usersConnected(server)
                    })
                else
                    usersConnected(serverID)
            });
            socket.on('message', data => {
                const { event, args } = JSON.parse(data.toString());
                if (event === 'online') {
                    let { serverId } = args[0];
                    userId = publicIdToId('users', args[0].userId)
                    serverID = publicIdToId('servers', serverId)
                    const server = db.getItem('servers', serverID)

                    channel = `message/${serverId}`
                    if (!sockets.has(channel)) sockets.set(channel, new Set())
                    sockets.get(channel).add(socket)

                    member = `member/${serverID}`
                    if (!members.has(member)) members.set(member, new Set())
                    members.get(member).add(userId)

                    servers(userId)

                    if (server.users == 'ALL' || server.users.find(user => user.id == userId)) {
                        usersConnected(serverID)
                        channels(serverID)
                        if (events.has(event))
                            events.get(event)!.forEach(fn => fn(socket, ...args));
                    }
                }
                else if (event === 'api/login') {
                    isBot = true
                    const token = args[0];
                    const bot = db.get('users').filter(user => user.bot && user.token == token)[0] as bot;
                    userId = bot.id;
                    if (!bot) return socket.close(1, 'Not access');
                    channel = `api/token/${token}`
                    if (!sockets.has(channel)) sockets.set(channel, new Set())
                    sockets.get(channel).add(socket)

                    db.get('servers').filter(server => {
                        if (server.users == 'ALL') return true;
                        else if (server.users.filter(user => user.id == bot.id)[0]) return true;
                        return false
                    }).forEach(server => {
                        serversId.push(server.id)
                        member = `member/${server.id}`
                        if (!members.has(member)) members.set(member, new Set())
                        members.get(member).add(userId)
                        usersConnected(server.id)
                    })
                }
                else if (events.has(event)) {
                    events.get(event)!.forEach(fn => fn(() => { }, ...args));
                }
            });
        });
        return (
            callback: (args: {
                on<E extends keyof events>(event: E, callback: events[E]): void;
                emit(event: string, ...args: any[]): void;
                iemit(event: string, ...args: any[]): void;
            }) => void
        ) => {
            callback(obj);
        };
    }
}
