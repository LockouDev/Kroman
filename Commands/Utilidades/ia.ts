import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js'
import { isUserAuthorized } from '../../Utils/authorizations'

const OpenRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions'
const Model = 'stealth/ox-alpha'
const RequestTimeoutMs = 55_000
const MaxPromptLength = 4_000
const MaxEmbedDescriptionLength = 4_000

type OpenRouterResponse = {
    choices?: Array<{
        message?: {
            content?: string | Array<{
                text?: string
            }>
        }
    }>
    error?: {
        message?: string
    }
}

function trimForEmbed(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text
    }

    return `${text.slice(0, maxLength - 1)}\u2026`
}

function getResponseContent(data: OpenRouterResponse): string {
    const content = data.choices?.[0]?.message?.content

    if (typeof content === 'string') {
        return content.trim()
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => part.text ?? '')
            .join('')
            .trim()
    }

    return ''
}

function buildErrorEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp()
}

const Command = {
    data: new SlashCommandBuilder()
        .setName('ia')
        .setDescription('Converse com a IA OX Alpha')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall,
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .addStringOption((Option) =>
            Option
                .setName('prompt')
                .setDescription('Pergunta ou instru\u00e7\u00e3o para a IA')
                .setRequired(true)
                .setMaxLength(MaxPromptLength),
        ),

    async run(_Client: unknown, Interaction: any): Promise<void> {
        const BotOwnerId = process.env.BOT_OWNER

        if (!isUserAuthorized(Interaction.user.id, 'ia', BotOwnerId)) {
            await Interaction.reply({
                embeds: [buildErrorEmbed('Acesso negado', 'Voc\u00ea n\u00e3o est\u00e1 autorizado(a) a usar este comando')],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const ApiKey = process.env.OX_ALPHA_KEY

        if (!ApiKey) {
            await Interaction.reply({
                embeds: [buildErrorEmbed('Configura\u00e7\u00e3o ausente', 'A chave da OX Alpha n\u00e3o foi configurada no bot')],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const Prompt = Interaction.options.getString('prompt', true).trim()

        if (!Prompt) {
            await Interaction.reply({
                embeds: [buildErrorEmbed('Prompt inv\u00e1lido', 'Envie uma pergunta ou instru\u00e7\u00e3o para a IA')],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await Interaction.deferReply()

        const Controller = new AbortController()
        const Timeout = setTimeout(() => Controller.abort(), RequestTimeoutMs)

        try {
            const Response = await fetch(OpenRouterEndpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${ApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER ?? 'https://discord.com',
                    'X-Title': 'Lockou-Bot',
                },
                body: JSON.stringify({
                    model: Model,
                    messages: [
                        {
                            role: 'system',
                            content: 'Voc\u00ea \u00e9 um assistente \u00fatil e claro. Responda em portugu\u00eas do Brasil, salvo se o usu\u00e1rio solicitar outro idioma. N\u00e3o revele seu racioc\u00ednio interno.',
                        },
                        {
                            role: 'user',
                            content: Prompt,
                        },
                    ],
                    max_tokens: 1024,
                    reasoning: {
                        exclude: true,
                    },
                }),
                signal: Controller.signal,
            })

            const Data = await Response.json().catch(() => ({})) as OpenRouterResponse

            if (!Response.ok) {
                if (Response.status === 401 || Response.status === 403) {
                    await Interaction.editReply({
                        embeds: [buildErrorEmbed('Falha de autentica\u00e7\u00e3o', 'A chave da OX Alpha foi recusada pelo OpenRouter')],
                    })
                    return
                }

                if (Response.status === 429) {
                    await Interaction.editReply({
                        embeds: [buildErrorEmbed('Limite tempor\u00e1rio atingido', 'O OpenRouter limitou novas requisi\u00e7\u00f5es. Aguarde um pouco antes de tentar novamente')],
                    })
                    return
                }

                await Interaction.editReply({
                    embeds: [buildErrorEmbed('OX Alpha indispon\u00edvel', trimForEmbed(Data.error?.message ?? `O OpenRouter retornou o erro ${Response.status}`, MaxEmbedDescriptionLength))],
                })
                return
            }

            const Answer = getResponseContent(Data)

            if (!Answer) {
                await Interaction.editReply({
                    embeds: [buildErrorEmbed('Resposta vazia', 'A OX Alpha n\u00e3o retornou texto para esta pergunta')],
                })
                return
            }

            const Embed = new EmbedBuilder()
                .setColor(0x98f768)
                .setTitle('OX Alpha')
                .setDescription(trimForEmbed(Answer, MaxEmbedDescriptionLength))
                .addFields({
                    name: 'Prompt',
                    value: trimForEmbed(Prompt, 1_024),
                })
                .setFooter({ text: 'OpenRouter \u2022 stealth/ox-alpha' })
                .setTimestamp()

            await Interaction.editReply({
                embeds: [Embed],
            })
        } catch (Error) {
            const IsTimeout = Error instanceof Error && Error.name === 'AbortError'

            await Interaction.editReply({
                embeds: [buildErrorEmbed(
                    IsTimeout ? 'Tempo esgotado' : 'Erro ao consultar a IA',
                    IsTimeout
                        ? 'A OX Alpha demorou mais de 55 segundos para responder'
                        : 'N\u00e3o foi poss\u00edvel consultar a OX Alpha agora. Tente novamente em alguns instantes',
                )],
            })
        } finally {
            clearTimeout(Timeout)
        }
    },
}

export default Command
