import waga from 'waga';
import mailer from '../mailer';
import DB from '@agacraft/http/DB'
import fetch from '@agacraft/http/request'

const DataBase = new DB()

function getDiscriminator(db: typeof DataBase, name:string){
    const count = db.get('users').filter(user=> atob(user.name).toLowerCase() == name.toLocaleLowerCase()).length+1;
    const reverseNumber = `0000${count}`.split('').reverse()
    reverseNumber.length = 4
    return (reverseNumber.reverse().join(''))
}

function toAuthor(user: any) {
    return { name: atob(user.name), verified: !!user.verified, image: user.image || 'https://cdn-icons-png.flaticon.com/512/1946/1946429.png', id: user.publicId, active: !!user.active, descriminator: user.discriminator, bot: user.bot }
}

export = function (db: typeof DataBase) {
    const router = waga.Router()

    router.get('login', (req, res) => {
        res.sendFile(`${__dirname}/../../public/login.html`)
    })
    router.get('register', (req, res) => {
        res.sendFile(`${__dirname}/../../public/register.html`)
    })
    router.post('login', waga.json(), (req, res) => {
        const { email, password } = req.body as unknown as { name: string, email: string, password: string };
        const user = db.get('users').filter(user => user.email === btoa(email) && user.password === btoa(password))[0]
        if (!user) return res.json({ status: 'error', data: JSON.stringify({error:'Email or password not found'}) })
        res.json({
            status: 'ok', data: JSON.stringify(toAuthor(user))
        })
    })
    router.post('register', waga.json(), async (req, res) => {
        const { name, email, password } = req.body as unknown as { name: string, email: string, password: string };
        const user = db.get('users').filter(user => user.email === btoa(email))[0]
        const discriminator = getDiscriminator(db, name)
        if (user) return res.json({ status: 'error', data: JSON.stringify({error:'Email register not found'}) })
        db.add('users', { name:btoa(name), email:btoa(email), password:btoa(password), bot:false, publicId:Date.now(), discriminator })
        mailer({ email, text: `Hello ${name}, we welcome you to AgaScord, we hope you enjoy this platform.`, title: `Hello AgaScord` })
        const login = await fetch(`http://${req.headers.host}/login`, {method:'POST', body:JSON.stringify({email, password})})
        res.json(login.json())
    })

    return router
}