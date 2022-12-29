import { WebSocket } from 'ws';
import DB from '@agacraft/http/DB'
import waga from 'waga';

import userController from './controller/user.controller';
import serverController from './controller/servers.controller';
import socketController from './controller/socket.controller';
import apiController from './controller/api.controller';

interface events {
  online(socket: WebSocket, { serverId, channelId }: { serverId: number, channelId: number }): void;
  connect(socket: WebSocket): void;
  disconnect(): void;
  message({ serverId, userId, channelId }: { serverId: number, userId: number, channelId: number }, message: string, id: number): void

  [key: string]: Function;
}

const app = waga();
const db = new DB();

let socket = null as unknown as {
  on<E extends keyof events>(event: E, callback: events[E]): void;
  emit(event: string, ...args: any[]): void;
  iemit(event: string, ...args: any[]): void;
};
const api = apiController(db)

function publicIdToId(type: string, publicId: number) {
  return db.get(type).find((value) => value.publicId == publicId)?.id
}
app.get('favicon.ico', (req, res) => {
  res.redirect('https://agacraft.ga/src/img/icono.ico')
});
app.get('bot.png', (req, res) => {
  res.redirect('https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiG06KwpqY2U7cEcMYw1JJRZBrpAXQCro7oMQA4kG2k5a8iWUbZBR0JMdChpKM2pTWLOXQ0n8cs9FFdMkxsJ5aWTTKFhKwPV7vPjMeyYQx_KiUtHcxSNay-RIoi0ZqycM6-VfsSy7dS0s1pFPM2hLqcLhtuUhO4q0ZBs1sMI3cwAzP_vULCtaLNP-hTeA/s28/vot.PNG')
})

function toAuthor(user: any) {
  return { name: atob(user.name), verified: !!user.verified, image: user.image || 'https://cdn-icons-png.flaticon.com/512/1946/1946429.png', id: user.publicId, active: !!user.active, discriminator: user.discriminator, bot: user.bot }
}

app.use('styles', waga.static(__dirname+'/../public/styles'))
app.use('js', (req, res, next)=>{
  let r = {...res, sendFile(path) {
    res.setHeader('Content-Type', 'application/javascript')
    res.sendFile(path)
  },} as typeof res;
  waga.static(__dirname+'/../public/js')(req, r, next)
})

app.get('api/user/:token', waga.json(), (req, res) => {
  const { token } = req.params as { token: string };
  const User = db.get('users').find(user => user.token == token)
  res.json(toAuthor(User))
})

app.post('api/message/:id', waga.json(), (req, res) => {
  const { channel, token } = req.body as unknown as { token: string, channel: number }
  const { id: messageId } = req.params as { id: string };
  const User = db.get('users').find(user => user.token == token)
  const Channel = db.getItem('channels', publicIdToId('channels', channel))
  const Server = db.getItem('servers', Channel.id)

  const Message = Channel.messages.find(message=>message.id==messageId)
  const validUser = Server.users == 'ALL' || Server.find(user => user.id == User.id)
  if (Message && validUser) res.json(api({ event: 'message', args: [Message, Channel.id, Server.id] }))
  else res.json({deleted:true})
})

app.post('api/message', waga.json(), (req, res) => {
  const { author, message, serverId, channelId } = req.body as unknown as { author: string, message: { type: 'TEXT', message: string }, serverId: number, channelId: number }
  const user = db.get('users').find(user => user.token == author)
  socket.iemit('message', (message: {
    userId: number;
    content: string;
    id: number;
  }) => {
    let response = api({ event: 'message', args: [message, publicIdToId('channels', channelId), publicIdToId('servers', serverId)] })
    res.json(response as Object)
  }, { serverId, channelId, userId: user?.publicId }, message)
})

app.post('api/messages', waga.json(), (req, res) => {
  const { author, messages, channelId, serverId } = req.body as unknown as { author: string, messages: number, serverId: number, channelId: number }
  const userAuthor = db.get('users').find(user => user.token == author);
  if (!userAuthor) return res.json([]);

  const server = db.getItem('servers', publicIdToId('servers', serverId))
  if (!server.channels.find(channel => channel.publicId == channelId)) return res.json([]);
  if (typeof server.users == 'object' && !server.users.find(user => user.id == userAuthor.id)) return res.json([]);

  const _messages = [...db.getItem('channels', publicIdToId('channels', channelId))?.messages].reverse().filter((_, i) => i < messages).reverse()
  const response = _messages.map(message => api({ event: 'message', args: [message, publicIdToId('channels', channelId), publicIdToId('servers', serverId)] }))
  res.json(response)
})

app.use(userController(db))

app.use(serverController(db))

const server = app.listen(3001, port => {
  console.log(`Server started on port ${port}`);
});
socketController(server, db).then(s => {
  socket = s
})