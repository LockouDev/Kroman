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
const MaxDiscordMessageLength = 2_000

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

    return `${text.slice(0, maxLength - 1)}…`
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

function buildPromptEmbed(prompt: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x98f768)
        .setTitle('OX Alpha')
        .setDescription(`**Prompt**\n${trimForEmbed(prompt, MaxEmbedDescriptionLength - 12)}`)
}

function countCodeFences(text: string): number {
    return text.match(/```/g)?.length ?? 0
}

function splitDiscordMessage(content: string): string[] {
    const Chunks: string[] = []
    let Remaining = content.trim()
    let IsInsideCodeBlock = false

    while (Remaining.length > 0) {
        const Prefix = IsInsideCodeBlock ? '```\n' : ''
        const MaxChunkLength = MaxDiscordMessageLength - Prefix.length - 4
        let CutAt = Math.min(Remaining.length, MaxChunkLength)

        if (CutAt < Remaining.length) {
            const LastLineBreak = Remaining.lastIndexOf('\n', CutAt)

            if (LastLineBreak > MaxChunkLength / 2) {
                CutAt = LastLineBreak
            }
        }

        const Segment = Remaining.slice(0, CutAt).trimEnd()
        Remaining = Remaining.slice(CutAt).trimStart()

        const EndsInsideCodeBlock = IsInsideCodeBlock !== (countCodeFences(Segment) % 2 === 1)
        const Suffix = EndsInsideCodeBlock ? '\n```' : ''

        Chunks.push(`${Prefix}${Segment}${Suffix}`)
        IsInsideCodeBlock = EndsInsideCodeBlock
    }

    return Chunks
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
                .setDescription('Pergunta ou instruções para a IA')
                .setRequired(true)
                .setMaxLength(MaxPromptLength),
        ),

    async run(_Client: unknown, Interaction: any): Promise<void> {
        const BotOwnerId = process.env.BOT_OWNER

        if (!isUserAuthorized(Interaction.user.id, 'ia', BotOwnerId)) {
            await Interaction.reply({
                embeds: [buildErrorEmbed('Acesso negado', 'Você não está autorizado(a) a usar este comando')],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const ApiKey = process.env.OX_ALPHA_KEY

        if (!ApiKey) {
            await Interaction.reply({
                embeds: [buildErrorEmbed('Configuração ausente', 'A chave da OX Alpha não foi configurada no bot')],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const Prompt = Interaction.options.getString('prompt', true).trim()

        if (!Prompt) {
            await Interaction.reply({
                embeds: [buildErrorEmbed('Prompt inválido', 'Envie uma pergunta ou instruções para a IA')],
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
                            content: 'Você é um assistente útil e claro, Responda em português do Brasil, salvo se o usuário solicitar outro idioma, Não revele seu raciocínio interno, Você pode pesquisar na internet quando a pergunta exigir informações atuais ou verificação de fatos, Ao usar pesquisa, cite os links das fontes relevantes na resposta',
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
                    plugins: [
                        {
                            id: 'web',
                        },
                    ],
                }),
                signal: Controller.signal,
            })

            const Data = await Response.json().catch(() => ({})) as OpenRouterResponse

            if (!Response.ok) {
                if (Response.status === 401 || Response.status === 403) {
                    await Interaction.editReply({
                        embeds: [buildErrorEmbed('Falha de autenticação', 'A chave da OX Alpha foi recusada pelo OpenRouter')],
                    })
                    return
                }

                if (Response.status === 429) {
                    await Interaction.editReply({
                        embeds: [buildErrorEmbed('Limite temporário atingido', 'O OpenRouter limitou novas requisições, Aguarde um pouco antes de tentar novamente')],
                    })
                    return
                }

                await Interaction.editReply({
                    embeds: [buildErrorEmbed('OX Alpha indisponível', trimForEmbed(Data.error?.message ?? `O OpenRouter retornou o erro ${Response.status}`, MaxEmbedDescriptionLength))],
                })
                return
            }

            const Answer = getResponseContent(Data)

            if (!Answer) {
                await Interaction.editReply({
                    embeds: [buildErrorEmbed('Resposta vazia', 'A OX Alpha não retornou texto para esta pergunta')],
                })
                return
            }

            await Interaction.editReply({
                embeds: [buildPromptEmbed(Prompt)],
            })

            for (const Chunk of splitDiscordMessage(Answer)) {
                await Interaction.followUp({
                    content: Chunk,
                    allowedMentions: {
                        parse: [],
                    },
                })
            }
        } catch (Error) {
            const IsTimeout = Error instanceof Error && Error.name === 'AbortError'

            await Interaction.editReply({
                embeds: [buildErrorEmbed(
                    IsTimeout ? 'Tempo esgotado' : 'Erro ao consultar a IA',
                    IsTimeout
                        ? 'A OX Alpha demorou mais de 55 segundos para responder'
                        : 'Não foi possível consultar a OX Alpha agora. Tente novamente em alguns instantes',
                )],
            })
        } finally {
            clearTimeout(Timeout)
        }
    },
}

export default Command
