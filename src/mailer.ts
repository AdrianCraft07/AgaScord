import nodemailer from 'nodemailer';

const pass = 'bxwernktoinmovsn'
const user = 'agacraft.contacto@gmail.com'

let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user,
        pass
    }
});

transporter.verify().then(() => {
    console.log('Ready for send emails')
})

export = function mailer({email, text, title}:{email:string, text:string, title:string}){
    transporter.sendMail({
        from: `AgaScord <${user}>`,
        to: email,
        subject: title,
        text
    })
}