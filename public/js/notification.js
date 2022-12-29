let oldNotification = {
    close() { }
}
export function createNotification({ text, author, onclick }) {
    if (Notification.permission == "granted") {
        const _notification = new Notification(text, {
            body: author.name,
            icon: author.image,
            silent: true,
        })
        _notification.addEventListener('show', () => {
            oldNotification.close()
            new Audio('https://cdn.discordapp.com/attachments/1041198178508222484/1043728576857518130/notification.mp3').play()
            oldNotification = _notification
        })
        _notification.addEventListener('click', onclick)
    } else {
        Notification.requestPermission().then(permission => {
            if (permission == "granted") {
                createNotification({ text, author })
            }
        })
    }
}