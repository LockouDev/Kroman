import { InteractionContextType, SlashCommandBuilder, AttachmentBuilder, CommandInteraction, ImageURLOptions, ApplicationIntegrationType, CacheType, User, MessageFlags } from 'discord.js';
import { message } from 'noblox.js';

module.exports = {

    data: new SlashCommandBuilder()

        .setName('avatar')
        .setDescription('Veja o avatar de um usuário')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .addUserOption(option =>
            option.setName('usuário')
                .setDescription('Usuário para ver o avatar')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID do usuário para ver o avatar (caso não esteja em comum)')
                .setRequired(false)),

    async run(client: any, interaction: CommandInteraction<CacheType>) {

        if (!interaction.isChatInputCommand()) return;

        try {

            let user: User | null = interaction.options.getUser('usuário');
            const id = interaction.options.getString('id');

            if (!user && id) {

                try {

                    user = await client.users.fetch(id);

                } catch {

                    return await interaction.reply({

                        content: '❌ Não encontrei nenhum usuário com esse ID',
                        flags: MessageFlags.Ephemeral

                    });

                }

            }

            if (!user) user = interaction.user;

            const avatarOptions: ImageURLOptions = {

                size: 4096,
                extension: user.avatar?.startsWith('a_') ? 'gif' : 'png'

            };

            const imageURL = user.displayAvatarURL(avatarOptions);
            const attachment = new AttachmentBuilder(imageURL)

                .setName(`avatar_${user.username}.${avatarOptions.extension}`);

            await interaction.reply({ files: [attachment] });

        } catch (error) {

            console.error('Erro no comando /avatar:', error);

            await interaction.reply({

                content: '❌ Erro ao exibir o avatar, Tente novamente mais tarde',
                flags: MessageFlags.Ephemeral

            });

        }

    }

}