require('dotenv').config();
const { REST, Routes, Collection } = require('discord.js');
const fs = require('fs').promises;
require('colors');
const { register } = require('ts-node');

register({
    transpileOnly: true,
});

async function commandsHandler(client) {

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    const localSlashCommands = new Collection();
    const globalSlashCommands = new Collection();
    const loadedLocalCommands = [];
    const loadedGlobalCommands = [];

    try {
        const folders = await fs.readdir('./Commands');

        for (const folder of folders) {

            const files = await fs.readdir(`./Commands/${folder}/`);

            for (const file of files) {

                if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;

                const command = require(`../Commands/${folder}/${file}`);

                if (!command.data || !command.run) {

                    console.log(`⚠️ Comando "${file}" está incompleto`.yellow);

                    continue;

                }

                if (command.data.guildOnly) {

                    localSlashCommands.set(command.data.name, command);
                    loadedLocalCommands.push(command.data.toJSON());

                } else {

                    globalSlashCommands.set(command.data.name, command);
                    loadedGlobalCommands.push(command.data.toJSON());

                }

            }

        }

        client.slashCommands = { local: localSlashCommands, global: globalSlashCommands };

        client.once('ready', async () => {

            const guildId = process.env.DISCORD_GUILD_ID;
            const guild = client.guilds.cache.get(guildId);

            if (guild) {

                await syncCommands(

                    guild,
                    rest,
                    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
                    loadedLocalCommands,
                    'guild'

                );

            } else {

                console.warn('⚠️ ID do servidor para comandos locais não encontrado'.yellow);

            }

            // Deduplica os comandos globais com base no nome:
            const uniqueGlobalCommands = Array.from(

                new Map(loadedGlobalCommands.map(cmd => [cmd.name, cmd])).values()

            );

            await syncCommands(

                null,
                rest,
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                uniqueGlobalCommands,
                'global'

            );

        });

    } catch (error) {

        console.error('Erro ao carregar comandos:', error);

    }

}

async function syncCommands(guild, rest, route, commands, scope) {

    try {

        console.log(`🔄 Sincronizando comandos ${scope}...`.cyan);

        const existingCommands = await rest.get(route);

        const toRegister = [];
        const toUpdate = [];
        const toDelete = existingCommands.slice();

        for (const cmd of commands) {

            const existing = existingCommands.find(ec => ec.name === cmd.name);

            if (existing) {

                const isDifferent = JSON.stringify(existing) !== JSON.stringify(cmd);

                if (isDifferent) {

                    toUpdate.push({ id: existing.id, ...cmd });

                }

                const index = toDelete.indexOf(existing);

                if (index !== -1) toDelete.splice(index, 1);

            } else {

                toRegister.push(cmd);

            }

        }

        // Registra novos comandos
        for (const cmd of toRegister) {

            await rest.post(route, { body: cmd });
            console.log(`✅ Novo comando "${cmd.name}" registrado`.green);

        }

        // Atualiza comandos alterados
        for (const cmd of toUpdate) {

            await rest.patch(`${route}/${cmd.id}`, { body: cmd });
            console.log(`✅ Comando "${cmd.name}" atualizado`.green);

        }

        // Opcional: Remova comandos que não existem mais
        for (const cmd of toDelete) {

            await rest.delete(`${route}/${cmd.id}`);
            console.log(`🗑️ Comando "${cmd.name}" removido`.yellow);
            
        }

        console.log(`✅ Sincronização de comandos ${scope} concluída!`.green);

    } catch (error) {

        console.error(`❌ Erro ao sincronizar comandos ${scope}:`, error);

    }

}

module.exports = commandsHandler;