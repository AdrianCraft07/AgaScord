import waga from 'waga';
import fs from 'fs';

export = function (db: any) {
  const router = waga.Router()

  function publicIdToId(type: string, publicId: number) {
    return db.get(type).find((value) => value.publicId == publicId)?.id as number
  }
  function idToPublicId(type:string, id:number){
    return db.getItem(type, id).publicId as number
  }

  function getHTML(host: string, server: number = 1, channel:number = 1) {
    return fs
      .readFileSync(__dirname + '/../../public/index.html', 'utf8')
      .replaceAll('%HOST%', host)
      .replaceAll('%SERVER%', `${idToPublicId('servers', server)}`)
      .replaceAll('%CHANNEL%', `${idToPublicId('channels', channel)}`);
  }

  router.get('/', (req, res) => {
    res.send(getHTML(req.headers.host as string, 1, 1));
  });

  router.get('/server/:server', (req, res) => {
    const server = db.getItem('servers', publicIdToId('servers',+req.params.server))
    if(!server) return res.status(404).send('Invalid Server')
    res.send(getHTML(req.headers.host as string, server.id, server.channels[0].id));
  });

  router.get('/channel/:server/:channel', (req, res)=>{
    const server = db.getItem('servers', publicIdToId('servers',+req.params.server))
    if(!server) return res.status(404).send('Invalid Server')
    if(!server.channels.filter((channel:any)=>channel.publicId==req.params.channel)[0])return res.redirect(`/server/${server.publicId}`)
    res.send(getHTML(req.headers.host as string, server.id, publicIdToId('channels', +req.params.channel)))
  })

  return router
}