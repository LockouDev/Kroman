require('colors')

module.exports = {

    name: 'ready',
    execute: (client) => {

        client.on('ready', async () => {

            console.log(`✅ Bot Online: ${client.user.tag}`.green)

        })

    }

}