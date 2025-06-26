import 'dotenv/config';
import {
    InteractionContextType,
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    ApplicationIntegrationType,
    MessageFlags
} from 'discord.js';
import { exec } from 'child_process';
import noblox, { setCookie } from 'noblox.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

interface Authorization {
    userId: string;
    commandName: string;
}

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

        .setName('pagar')
        .setDescription('Pagar usuário do roblox!')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .addStringOption(option =>
            option
                .setName('player')
                .setDescription('Player do Roblox que receberá os Robux')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('quantidade')
                .setDescription('Quantidade de Robux')
                .setRequired(true)
        ),

    async run(client: any, interaction: any) {

        const userId = interaction.options.getString('player');
        const robuxAmount = interaction.options.getInteger('quantidade');
        const groupId = parseInt(process.env.GROUPID!);

        const authorizations: Authorization[] = loadAuthorizations();

        const isAuthorized =

            interaction.user.id === process.env.BOT_OWNER ||
            (authorizations as any[]).some(

                (auth: any) => auth.userId === interaction.user.id && auth.commandName === 'pagar'

            );

        if (!isAuthorized) {

            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('❌ Acesso Negado')
                .setDescription('Você não está autorizado(a) a usar este comando. Solicite permissão ao proprietário do bot');

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

        await interaction.deferReply();

        try {

            const playerId = await noblox.getIdFromUsername(userId);
            const groupFunds = await noblox.getGroupFunds(groupId);
            const playerName = await noblox.getUsernameFromId(playerId as number);

            // Validação de fundos do grupo
            if (groupFunds < robuxAmount) {

                const embed = new EmbedBuilder()

                    .setColor('#FB5151')
                    .setTitle('❌ Fundo Insuficiente')
                    .setThumbnail('https://media.tenor.com/97Zio3BdYvQAAAAj/fluent-emoji.gif')
                    .setDescription(
                        `O grupo possui apenas **${groupFunds}** Robux disponíveis.`
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            }

            // Validação de associação ao grupo
            const userGroups = await noblox.getGroups(playerId as number);
            const isMember = userGroups.some((group) => group.Id === groupId);

            if (!isMember) {

                const embed = new EmbedBuilder()
                    .setColor('#FB5151')
                    .setTitle('⚠️ Usuário não está no grupo')
                    .setDescription(
                        `O usuário **${playerName}** não faz parte do grupo,\nCertifique-se de que ele está no grupo antes de tentar realizar o pagamento`
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            }

            // Execução do pagamento
            const filePath = path.resolve(__dirname, '../../Utils/payment.py');
            const command = `python3 ${filePath} ${playerId} ${robuxAmount}`;

            exec(command, (error, stdout, stderr) => {

                if (error || stderr) {

                    console.error(`exec error: ${error}`);

                    const embed = new EmbedBuilder()

                        .setColor('#FB5151')
                        .setTitle('❌ Ocorreu um erro ao processar a solicitação')
                        .setDescription(`Erro interno, Tente novamente mais tarde`)
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });

                }

                if (stdout.includes('Robux successfully sent!')) {

                    const embed = new EmbedBuilder()

                        .setColor('#50FB5B')
                        .setTitle('<:Confirm:1315286412664508426> Pagamento Realizado com Sucesso!')
                        .setThumbnail('https://i.imgur.com/Qm2lbd3.png')
                        .addFields(
                            {
                                name: '<:Roblox:1314141291621126165> Usuário:',
                                value: `**${playerName}**`,
                                inline: true,
                            },
                            {
                                name: '<:Robux:1311957287178469447> Robux:',
                                value: `**${robuxAmount}**`,
                                inline: true,
                            }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });

                } else if (stdout.includes('not found')) {

                    const embed = new EmbedBuilder()

                        .setColor('#FB5151')
                        .setTitle('⚠️ Usuário não encontrado')
                        .setThumbnail(
                            'https://i.pinimg.com/originals/94/d6/66/94d6668cb38b312395c40c0e77be5566.gif'
                        )
                        .setDescription(
                            `Ocorreu um erro ao tentar buscar o usuário **${userId}**. Verifique se o nome está correto.`
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });

                } else {

                    const embed = new EmbedBuilder()

                        .setColor('#FB5151')
                        .setTitle('⚠️ Erro desconhecido')
                        .setDescription(`Mensagem retornada: ${stdout}`)
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });

                }

            });

        } catch (error) {

            console.error('Erro:', error);

            const embed = new EmbedBuilder()

                .setColor('#FB5151')
                .setTitle('⚠️ Erro ao processar solicitação')
                .setDescription(
                    'Não foi possível buscar o usuário no Roblox. Verifique se o nome está correto'
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] }).catch(() => { });

        }

    },

};