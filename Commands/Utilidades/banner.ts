import { InteractionContextType, SlashCommandBuilder, AttachmentBuilder, CommandInteraction, ImageURLOptions, ApplicationIntegrationType, CacheType, User, MessageFlags } from 'discord.js';

module.exports = {

    data: new SlashCommandBuilder()

        .setName('banner')
        .setDescription('Veja o banner de um usuário')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .addUserOption(option =>
            option.setName('usuário')
                .setDescription('Usuário para ver a banner')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID do usuário para ver a banner (caso não esteja em comum)')
                .setRequired(false)),

    async run(client: any, interaction: CommandInteraction) {

        if (!interaction.isChatInputCommand()) return;

        try {

            let user: User | null = interaction.options.getUser('usuário');
            const id = interaction.options.getString('id');

            if (!user && id) {

                try {

                    user = await client.users.fetch(id);

                } catch {

                    return interaction.reply({

                        content: '❌ Não encontrei nenhum usuário com esse ID',
                        flags: MessageFlags.Ephemeral

                    });

                }

            }

            if (!user) user = interaction.user;

            const fetchedUser = await client.users.fetch(user.id, { force: true });
            const bannerUrl = fetchedUser.bannerURL({ size: 4096, extension: 'png' })

            if (!bannerUrl) {

                return await interaction.reply({

                    content: `❌ O usuário **${user.username}** não possui um banner`,
                    flags: MessageFlags.Ephemeral

                });

            }

            const extension = bannerUrl.includes('.gif') ? 'gif' : 'png';
            const attachment = new AttachmentBuilder(bannerUrl).setName(

                `banner_${user.username}.${extension}`

            );

            await interaction.reply({ files: [attachment] });

        } catch (error) {

            console.error('Erro no comando /banner:', error);

            await interaction.reply({

                content: '❌ Erro ao exibir o avatar, Tente novamente mais tarde',
                flags: MessageFlags.Ephemeral

            });

        }

    }

}