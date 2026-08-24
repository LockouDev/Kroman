import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js'
import {
    type Authorization,
    loadAuthorizations,
    saveAuthorizations,
} from '../../Utils/authorizations'

const AuthorizedCommands = [
    'ia',
    'pagar',
    'gerarpix',
] as const

function buildEmbed(title: string, description: string, color: number): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
}

function isAuthorizedCommand(commandName: string): boolean {
    return AuthorizedCommands.includes(commandName as typeof AuthorizedCommands[number])
}

const Command = {
    data: new SlashCommandBuilder()
        .setName('autorizar')
        .setDescription('Gerencia autorizações de comandos sensíveis')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall,
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .addSubcommand((Subcommand) =>
            Subcommand
                .setName('adicionar')
                .setDescription('Autoriza uma pessoa a usar um comando')
                .addUserOption((Option) =>
                    Option
                        .setName('usuario')
                        .setDescription('Pessoa que receberá a autorização')
                        .setRequired(true),
                )
                .addStringOption((Option) =>
                    Option
                        .setName('comando')
                        .setDescription('Comando que será liberado')
                        .setRequired(true)
                        .addChoices(
                            ...AuthorizedCommands.map((Name) => ({
                                name: Name,
                                value: Name,
                            })),
                        ),
                ),
        )
        .addSubcommand((Subcommand) =>
            Subcommand
                .setName('remover')
                .setDescription('Remove a autorização de uma pessoa')
                .addUserOption((Option) =>
                    Option
                        .setName('usuario')
                        .setDescription('Pessoa que perderá a autorização')
                        .setRequired(true),
                )
                .addStringOption((Option) =>
                    Option
                        .setName('comando')
                        .setDescription('Comando que será removido')
                        .setRequired(true)
                        .addChoices(
                            ...AuthorizedCommands.map((Name) => ({
                                name: Name,
                                value: Name,
                            })),
                        ),
                ),
        )
        .addSubcommand((Subcommand) =>
            Subcommand
                .setName('listar')
                .setDescription('Mostra as autorizações atuais')
        ),

    async run(_Client: unknown, Interaction: any): Promise<void> {
        const BotOwnerId = process.env.BOT_OWNER

        if (!BotOwnerId || Interaction.user.id !== BotOwnerId) {
            await Interaction.reply({
                embeds: [buildEmbed('Acesso negado', 'Somente o dono do bot pode gerenciar autorizações', 0xed4245)],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const Subcommand = Interaction.options.getSubcommand()

        if (Subcommand === 'listar') {
            const Authorizations = loadAuthorizations()
            const Description = Authorizations.length === 0
                ? 'Nenhuma autorização adicional foi registrada'
                : Authorizations
                    .map((Authorization) => `<@${Authorization.userId}> • /${Authorization.commandName}`)
                    .join('\n')

            await Interaction.reply({
                embeds: [buildEmbed('Autorizações atuais', Description, 0x5865f2)],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const User = Interaction.options.getUser('usuario', true)
        const CommandName = Interaction.options.getString('comando', true)

        if (!isAuthorizedCommand(CommandName)) {
            await Interaction.reply({
                embeds: [buildEmbed('Comando inválido', `O comando \`${CommandName}\` não está na lista de comandos autorizáveis`, 0xed4245)],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const Authorizations = loadAuthorizations()
        const ExistingIndex = Authorizations.findIndex(
            (Authorization) =>
                Authorization.userId === User.id &&
                Authorization.commandName === CommandName,
        )

        if (Subcommand === 'adicionar') {
            if (ExistingIndex !== -1) {
                await Interaction.reply({
                    embeds: [buildEmbed('Já autorizado', `${User.username} já pode usar \`/${CommandName}\``, 0xfee75c)],
                    flags: MessageFlags.Ephemeral,
                })
                return
            }

            const NewAuthorization: Authorization = {
                userId: User.id,
                commandName: CommandName,
            }

            saveAuthorizations([...Authorizations, NewAuthorization])

            await Interaction.reply({
                embeds: [buildEmbed('Autorização adicionada', `${User.username} agora pode usar \`/${CommandName}\``, 0x57f287)],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        if (ExistingIndex === -1) {
            await Interaction.reply({
                embeds: [buildEmbed('Autorização não encontrada', `${User.username} não possui acesso a \`/${CommandName}\``, 0xfee75c)],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        saveAuthorizations(Authorizations.filter((_, Index) => Index !== ExistingIndex))

        await Interaction.reply({
            embeds: [buildEmbed('Autorização removida', `${User.username} não pode mais usar \`/${CommandName}\``, 0xed4245)],
            flags: MessageFlags.Ephemeral,
        })
    },
}

export default Command
