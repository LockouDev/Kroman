import {
    InteractionContextType,
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    ApplicationIntegrationType
} from 'discord.js';

module.exports = {

    data: new SlashCommandBuilder()

        .setName('porcentagem')
        .setDescription('Veja o resultado de uma porcentagem em 70% para colocar em uma Gamepass do Roblox')
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
                .setName('valor')
                .setDescription('Valor para converter com a porcentagem')
                .setRequired(true)),

    async run(client: any, interaction: any) {

        const valorString = interaction.options.getString('valor');
        const valor = parseFloat(valorString);

        if (isNaN(valor)) {

            return interaction.reply({

                content: '❌ Por favor, insira um valor numérico',
                ephemeral: true,

            });

        }

        const resultado = Math.ceil(valor / 0.7);

        const embed = new EmbedBuilder()

            .setColor('#98F768')
            .setTitle(`70% de ${valor}`)
            .setDescription(`${resultado}`);

        await interaction.reply({ embeds: [embed] });

    },

};