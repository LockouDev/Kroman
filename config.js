require('dotenv').config();

const config = {

    discord: {

        token: process.env.DISCORD_BOT_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
        guildId: process.env.DISCORD_GUILD_ID,
        botOwner: process.env.BOT_OWNER,
        color: "00FF2F"

    },

    roblox: {

        token: process.env.COOKIE,
        groupId: process.env.GROUPID,
        secret: process.env.TWOFACTOR,
        csrf: process.env.ROBLOX_X_CSRF_TOKEN,
        color: "00FF2F"

    }

}

module.exports = config