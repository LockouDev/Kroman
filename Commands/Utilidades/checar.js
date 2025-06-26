require('dotenv').config();
const { InteractionContextType, EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, MessageFlags } = require('discord.js');
const config = require('../../config');
const noblox = require('noblox.js');
const axios = require('axios');
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
        .setName('checar')
        .setDescription('Checar se o jogador está elegível no grupo')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Nickname do player')
                .setRequired(true)),

    async run(client, interaction) {

        await interaction.deferReply();

        const player = interaction.options.getString('player');
        const groupId = process.env.GROUPID;
        const botOwnerId = process.env.BOT_OWNER;

        const authorizations = loadAuthorizations();

        const isAuthorized =
            interaction.user.id === botOwnerId ||
            authorizations.some(

                (auth) => auth.userId === interaction.user.id && auth.commandName === 'checar'

            );

        if (!isAuthorized) {

            const embed = new EmbedBuilder()

                .setColor('Red')
                .setTitle('❌ Acesso Negado')
                .setDescription('Você não está autorizado(a) a usar este comando, Solicite permissão ao proprietário do bot');

            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

        let userId;

        try {

            userId = await noblox.getIdFromUsername(player);
            
        } catch (error) {
            
            const embed = new EmbedBuilder()
                .setColor('#FB5151')
                .setTitle('<:ContentDeleted:1315331180521979904> Usuário não encontrado')
                .setDescription(`Parece que o jogador **${player}** não existe no Roblox`);

            return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

        // Verifica se o usuário está banido via API pública (Roblox users endpoint)
        let playerInfo;

        try {

            const { data } = await axios.get(`https://users.roblox.com/v1/users/${userId}`);

            playerInfo = data;
            
        } catch (error) { } // Pode ignorar erro aqui, só seguir em frente

        if (playerInfo?.isBanned) {

            const thumbHead = await noblox.getPlayerThumbnail(userId, '420x420', 'png', true, 'headshot');
            const playerName = await noblox.getUsernameFromId(userId);

            const embed = new EmbedBuilder()
                .setColor('#FB5151')
                .setTitle(`<:Locked:1315627104473186364> ${playerName}`)
                .setDescription('Esta conta está banida no Roblox')
                .setThumbnail(thumbHead[0]?.imageUrl);

            return interaction.editReply({ embeds: [embed] });

        }

        try {

            const cookie = process.env.COOKIE;

            let userId;

            try {

                userId = await noblox.getIdFromUsername(player);

            } catch (error) {

                return interaction.editReply({

                    embeds: [

                        new EmbedBuilder()
                            .setColor('#FB5151')
                            .setTitle('<:ContentDeleted:1315331180521979904> Usuário não encontrado')
                            .setDescription(`Parece que o jogador **${player}** não existe no Roblox`)

                    ],

                    flags: MessageFlags.Ephemeral

                });

            }

            const thumbHead = await noblox.getPlayerThumbnail(userId, '420x420', 'png', true, 'headshot');

            const userGroups = await noblox.getGroups(userId);
            const playerName = await noblox.getUsernameFromId(userId);
            const isMember = userGroups.some((group) => group.Id === parseInt(groupId));

            if (!isMember) {

                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: playerName,
                        iconURL: thumbHead[0]?.imageUrl
                    })
                    .setColor('#FB5151')
                    .setTitle('⚠️ Usuário não está no grupo')
                    .setDescription(`O jogador **${playerName}** não faz parte do grupo,\nCertifique-se de que ele se juntou ao grupo.\nPara acessar o grupo, [clique aqui](https://www.roblox.com/communities/15979531)`);

                return interaction.editReply({ embeds: [embed] });
            }

            const url = `https://economy.roblox.com/v1/groups/${groupId}/users-payout-eligibility?userIds=${userId}`;

            const response = await axios.get(url, {

                headers: {

                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'

                }

            });

            const eligibilityData = response.data.usersGroupPayoutEligibility[userId];

            const isUserEligible = eligibilityData === 'Eligible';

            const embed = new EmbedBuilder()

                .setColor(isUserEligible ? '#00ff00' : '#ff0000')
                .setTitle(isUserEligible ? `<:Confirm:1315286412664508426> ${playerName} é elegível` : `<:Decline:1315286423170977803> ${playerName} não é elegível`)
                .setThumbnail(thumbHead[0]?.imageUrl);

            if (!isUserEligible) {

                embed.setDescription('Será preciso esperar alguns dias para se tornar elegível, algo em torno de 4 dias ou 14 dias');

            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {

            console.error('Erro ao verificar elegibilidade:', error);

            await interaction.editReply({ content: 'Ocorreu um erro ao verificar a elegibilidade do jogador', flags: MessageFlags.Ephemeral });

        }

    }

}