require('dotenv').config();
const { InteractionContextType, EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, MessageFlags } = require('discord.js');
const config = require('../../config');
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'Registro', 'autorizacoes.json');

function loadAuthorizations() {

    if (!fs.existsSync(filePath)) {

        fs.writeFileSync(filePath, '[]', 'utf-8');

    }

    const data = fs.readFileSync(filePath, 'utf-8');

    return JSON.parse(data);

}

module.exports = {

    data: new SlashCommandBuilder()
        .setName('tabela')
        .setDescription('Veja a tabela de valores!')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

    async run(client, interaction) {

        const botOwnerId = process.env.BOT_OWNER;

        const authorizations = loadAuthorizations();
        const isAuthorized =
            interaction.user.id === botOwnerId ||
            authorizations.some(

                (auth) => auth.userId === interaction.user.id && auth.commandName === 'tabela'

            );

        if (!isAuthorized) {

            const embed = new EmbedBuilder()

                .setColor('Red')
                .setTitle('❌ Acesso Negado')
                .setDescription('Você não está autorizado(a) a usar este comando. Solicite permissão ao proprietário do bot');

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

        try {

            await interaction.deferReply();

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Tabela de valores')
                .setThumbnail('https://cdn3.emoji.gg/emojis/3792-roblox2.gif')
                .setAuthor({

                    name: 'd46014ef-b202-4846-b548-8db0f5272097',
                    iconURL: 'https://cdn3.emoji.gg/emojis/20540-pix.png'

                })
                .addFields(

                    { name: '<:Reais2:1313185265778692126> 30,00', value: '<:Robux:1311957287178469447> 1.000', inline: true },
                    { name: '<:Reais2:1313185265778692126> 60,00', value: '<:Robux:1311957287178469447> 2.500', inline: true },
                    { name: '<:Reais2:1313185265778692126> 100,00', value: '<:Robux:1311957287178469447> 4.000', inline: true },
                    { name: '<:Reais2:1313185265778692126> 200,00', value: '<:Robux:1311957287178469447> 10.000', inline: true },
                    { name: '<:Reais2:1313185265778692126> 300,00', value: '<:Robux:1311957287178469447> 15.000', inline: true },
                    { name: '<:Reais2:1313185265778692126> 400,00', value: '<:Robux:1311957287178469447> 24.000', inline: true },
                    { name: '<:Reais2:1313185265778692126> 500,00', value: '<:Robux:1311957287178469447> 30.000', inline: true },
                    { name: '<:Reais2:1313185265778692126> 1.000,00', value: '<:Robux:1311957287178469447> 52.000', inline: true },
                    { name: '<:Reais2:1313185265778692126> 2.500,00', value: '<:Robux:1311957287178469447> 100.000', inline: true },

                );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {

            console.error(error);

        }

    }

}
