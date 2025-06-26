require('dotenv').config();
const { InteractionContextType, EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, MessageFlags } = require('discord.js');
const config = require('../../config');
const noblox = require('noblox.js');
const cor = require('../../config').discord.color;
const path = require('path');
const fs = require('fs');

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
        .setName('fundos')
        .setDescription('Veja os fundos do grupo!')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

    async run(client, interaction) {

        const botOwnerId = process.env.BOT_OWNER;

        const authorizations = loadAuthorizations();
        const isAuthorized =
            interaction.user.id === botOwnerId ||
            authorizations.some(

                (auth) => auth.userId === interaction.user.id && auth.commandName === 'fundos'

            );

        if (!isAuthorized) {

            const embed = new EmbedBuilder()

                .setColor('Red')
                .setTitle('❌ Acesso Negado')
                .setDescription('Você não está autorizado(a) a usar este comando. Solicite permissão ao proprietário do bot');

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

        const groupId = '15979531'

        try {

            await interaction.deferReply();

            const group = await noblox.getGroup(groupId);
            const funds = await noblox.getGroupFunds(groupId);
            const pending = await noblox.getGroupRevenueSummary(groupId);
            const logo = await noblox.getLogo(groupId, '150x150', false, 'Png');

            const embed = new EmbedBuilder()
                .setColor(cor)
                .setAuthor({
                    name: group.name,
                    iconURL: logo
                })
                .addFields(
                    { name: 'Fundos do Grupo:', value: `<:Robux:1311957287178469447> **${funds.toLocaleString()}**`, inline: false },
                    { name: 'Fundos Pendentes:', value: `<:Pending:1330615382603464906> ${pending.pendingRobux.toLocaleString()}`, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {

            console.error(error);

            await interaction.editReply({

                content: '❌ Ocorreu um erro ao obter os fundos do grupo',
                ephemeral: true

            });

        }

    }

}