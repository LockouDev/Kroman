const noblox = require('noblox.js');
require('dotenv').config();

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const GROUP_ID = process.env.GROUPID;

async function updateChannelName(client) {

    try {

        const guild = await client.guilds.fetch(GUILD_ID);

        if (!guild) {

            console.error(`[ERROR] Não foi possível encontrar a guilda com ID: ${GUILD_ID}`);

            return;
        }


        // Verifica se o canal foi encontrado
        const channel = await guild.channels.fetch(CHANNEL_ID);

        if (!channel) {

            console.error(`[ERROR] Não foi possível encontrar o canal com ID: ${CHANNEL_ID}`);

            return;

        }

        try {

            const groupFunds = await noblox.getGroupFunds(GROUP_ID);

            const newChannelName = `💵 ${groupFunds} Robux`;

            if (channel.name !== newChannelName) {

                await channel.setName(newChannelName);

            }

        } catch (error) {

            if (error.message.includes('429')) {

                console.error('[ERROR] Rate Limit atingido. Esperando alguns segundos antes de tentar novamente');

            }

        }

    } catch (error) {

        console.error('[ERROR] Falha ao atualizar o nome do canal:', error);

    }

}

function startChannelUpdater(client) {

     // Atualiza a cada 10 segundo (10000 milissegundos)
     setInterval(() => {

        updateChannelName(client);

    }, 10000);

}

module.exports = {

    name: 'groupInformation',
    once: false,

    execute(client) {

        startChannelUpdater(client);

    }

};