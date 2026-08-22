import {
    ApplicationIntegrationType,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js'
import { execFile } from 'node:child_process'
import Path from 'node:path'
import { promisify } from 'node:util'
import { isUserAuthorized } from '../../Utils/authorizations'

const ExecFileAsync = promisify(execFile)
const ScriptPath = Path.join(process.cwd(), 'Utils', 'Pagamento.py')

type PythonAttempt = {
    command: string
    args?: string[]
}

type RobloxUser = {
    id: number
    name: string
    displayName: string
}

type RobloxThumbnailResponse = {
    data?: Array<{
        imageUrl?: string
    }>
}

type PayoutEligibilityResult = {
    eligible: boolean | null
    raw: string
}

const IneligibleEmojiUrl = 'https://images-ext-1.discordapp.net/external/FPQpMeYLCSsEK4jy_iLZxWft2UjRvcX9U8HYwTr1N50/https/images.emojiterra.com/google/noto-emoji/animated-emoji/1f914.gif'
const SuccessEmojiUrl = 'https://i.imgur.com/Qm2lbd3.png'

const PythonCandidates: PythonAttempt[] =
    process.platform === 'win32'
        ? [
            { command: 'python' },
            { command: 'py', args: ['-3'] },
        ]
        : [
            { command: Path.join(process.cwd(), '.venv', 'bin', 'python') },
            { command: 'python3' },
            { command: 'python' },
        ]

async function runPagamentoScript(player: string, amount: number): Promise<{
    stdout: string
    stderr: string
    commandUsed: string
}> {
    let lastError: unknown

    for (const candidate of PythonCandidates) {
        try {
            const args = [...(candidate.args ?? []), ScriptPath, player, String(amount)]
            const result = await ExecFileAsync(candidate.command, args, {
                cwd: process.cwd(),
                env: process.env,
                timeout: 120_000,
                windowsHide: true,
            })

            return {
                stdout: result.stdout ?? '',
                stderr: result.stderr ?? '',
                commandUsed: [candidate.command, ...(candidate.args ?? [])].join(' '),
            }
        } catch (error: any) {
            lastError = error

            if (error?.code === 'ENOENT') {
                continue
            }

            return {
                stdout: error?.stdout ?? '',
                stderr: error?.stderr ?? '',
                commandUsed: [candidate.command, ...(candidate.args ?? [])].join(' '),
            }
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error('Nenhum interpretador Python disponível no ambiente')
}

function summarizeOutput(stdout: string, stderr: string): {
    title: string
    color: number
    description: string
} {
    const output = `${stdout}\n${stderr}`.trim()

    if (output.includes('[PY] payout finalizado com sucesso')) {
        return {
            title: 'Pagamento concluído',
            color: 0x57f287,
            description: 'O pagamento foi processado com sucesso',
        }
    }

    if (hasBlockSession(stdout, stderr)) {
        return {
            title: 'Sessão bloqueada',
            color: 0xed4245,
            description: 'A Roblox bloqueou temporariamente a sessão desta conta para a operação',
        }
    }

    if (output.includes('Challenge is required to authorize the request') || output.includes('challenge type: chef')) {
        return {
            title: 'Pagamento bloqueado por challenge',
            color: 0xfee75c,
            description: 'A Roblox exigiu validação adicional e o pagamento não foi concluído',
        }
    }

    return {
        title: 'Pagamento falhou',
        color: 0xed4245,
        description: 'O script retornou erro ao tentar enviar o pagamento',
    }
}

function extractRelevantLines(stdout: string, stderr: string): string {
    const joined = `${stdout}\n${stderr}`
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => line.startsWith('[PY]'))

    const relevant = joined.slice(-8)

    if (relevant.length === 0) {
        return 'Sem saída relevante do script'
    }

    return relevant.join('\n')
}

function buildFailureReason(stdout: string, stderr: string): string | null {
    if (hasBlockSession(stdout, stderr)) {
        return 'A Roblox bloqueou esta sessão. Aprove a sessão no e-mail/segurança da conta, gere um COOKIE novo e tente novamente'
    }

    const details = extractRelevantLines(stdout, stderr)

    if (!details || details === 'Sem saída relevante do script') {
        const rawOutput = `${stderr}\n${stdout}`
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(-6)
            .join(' | ')

        return rawOutput ? rawOutput.slice(0, 250) : null
    }

    const lines = details
        .split('\n')
        .map((line) => line.replace(/^\[PY\]\s*/, '').trim())
        .filter(Boolean)

    const priorityMatchers = [
        'blocksession depois do twostepverification',
        'a roblox bloqueou a sessão',
        'erro final:',
        'mensagem inicial:',
        'continue chef body:',
        'continue twostepverification body:',
        'continue two step body:',
        'payout falhou',
    ]

    for (const matcher of priorityMatchers) {
        const found = lines.find((line) => line.toLowerCase().includes(matcher))

        if (found) {
            return found.slice(0, 250)
        }
    }

    return lines[lines.length - 1]?.slice(0, 250) ?? null
}

function getPaymentSucceeded(stdout: string, stderr: string): boolean {
    return `${stdout}\n${stderr}`.includes('[PY] payout finalizado com sucesso')
}

function hasBlockSession(stdout: string, stderr: string): boolean {
    return `${stdout}\n${stderr}`.toLowerCase().includes('blocksession')
}

function getPaymentRecipientIneligible(stdout: string, stderr: string): boolean {
    const output = `${stdout}\n${stderr}`.toLowerCase()

    return (
        output.includes('not eligible') ||
        output.includes('ineligible') ||
        output.includes('noteligible') ||
        output.includes('não é elegível') ||
        output.includes('nao é elegivel') ||
        output.includes('não elegível') ||
        output.includes('nao elegivel')
    )
}

function parseEligibilityValue(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value === 'number') {
        return value === 1
    }

    if (typeof value !== 'string') {
        if (value && typeof value === 'object') {
            const nestedValues = Object.values(value as Record<string, unknown>)

            for (const nestedValue of nestedValues) {
                const parsed = parseEligibilityValue(nestedValue)

                if (parsed !== null) {
                    return parsed
                }
            }
        }

        return null
    }

    const normalized = value
        .toLowerCase()
        .replace(/[\s_-]/g, '')

    if (
        normalized.includes('noteligible') ||
        normalized.includes('ineligible') ||
        normalized.includes('notpayouteligible') ||
        normalized.includes('false') ||
        normalized.includes('blocked') ||
        normalized.includes('restricted') ||
        normalized.includes('pending')
    ) {
        return false
    }

    if (
        normalized === 'eligible' ||
        normalized === 'true' ||
        normalized === 'payouteligible' ||
        normalized === 'canpayout'
    ) {
        return true
    }

    return null
}

function extractEligibility(data: any, userId: number): PayoutEligibilityResult {
    const userKey = String(userId)
    const raw = JSON.stringify(data)
    const directCandidates = [
        data?.usersGroupPayoutEligibility?.[userKey],
        data?.userPayoutEligibility?.[userKey],
        data?.payoutEligibility?.[userKey],
        data?.eligibility?.[userKey],
        data?.[userKey],
        data?.isEligible,
        data?.eligible,
        data?.canPayout,
    ]

    for (const candidate of directCandidates) {
        const parsed = parseEligibilityValue(candidate)

        if (parsed !== null) {
            return {
                eligible: parsed,
                raw,
            }
        }
    }

    const listedCandidate = Array.isArray(data?.data)
        ? data.data.find((item: any) => String(item?.userId ?? item?.id) === userKey)
        : null

    if (listedCandidate) {
        const listedValues = [
            listedCandidate.isEligible,
            listedCandidate.eligible,
            listedCandidate.canPayout,
            listedCandidate.status,
            listedCandidate.eligibility,
            listedCandidate.payoutEligibility,
        ]

        for (const candidate of listedValues) {
            const parsed = parseEligibilityValue(candidate)

            if (parsed !== null) {
                return {
                    eligible: parsed,
                    raw,
                }
            }
        }
    }

    return {
        eligible: null,
        raw,
    }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)

    if (!response.ok) {
        throw new Error(`GET ${url} retornou ${response.status}`)
    }

    return (await response.json()) as T
}

async function resolveRobloxUser(player: string): Promise<RobloxUser> {
    if (/^\d+$/.test(player)) {
        return await getJson<RobloxUser>(`https://users.roblox.com/v1/users/${player}`)
    }

    const response = await getJson<{ data?: RobloxUser[] }>('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            usernames: [player],
            excludeBannedUsers: false,
        }),
    })

    const user = response.data?.[0]

    if (!user) {
        throw new Error('Usuário do Roblox não encontrado')
    }

    return user
}

async function getRobloxAvatarHeadshot(userId: number): Promise<string | null> {
    const response = await getJson<RobloxThumbnailResponse>(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
    )

    return response.data?.[0]?.imageUrl ?? null
}

async function getPayoutEligibility(userId: number): Promise<PayoutEligibilityResult> {
    const Cookie = process.env.COOKIE
    const GroupId = process.env.GROUPID ?? '15979531'

    if (!Cookie) {
        return {
            eligible: null,
            raw: 'COOKIE não definido',
        }
    }

    const response = await fetch(
        `https://economy.roblox.com/v1/groups/${GroupId}/users-payout-eligibility?userIds=${userId}`,
        {
            headers: {
                Cookie: `.ROBLOSECURITY=${Cookie}`,
            },
        },
    )

    if (!response.ok) {
        return {
            eligible: null,
            raw: `Elegibilidade retornou ${response.status}`,
        }
    }

    const data = await response.json()

    return extractEligibility(data, userId)
}

function buildIneligibleEmbed(robloxUser: RobloxUser, rawEligibility?: string): EmbedBuilder {
    const Embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('⚠ Usuário não é elegível para o pagamento')
        .setDescription(`**${formatRobloxName(robloxUser)} ainda não é elegível para pagamento**\n\nSerá preciso esperar alguns dias para se tornar elegível, algo em torno de 4 dias ou 14 dias`)
        .setThumbnail(IneligibleEmojiUrl)
        .setTimestamp()

    if (rawEligibility && process.env.NODE_ENV === 'development') {
        Embed.addFields({
            name: 'Elegibilidade',
            value: `\`${rawEligibility.slice(0, 200)}\``,
        })
    }

    return Embed
}

function formatRobloxName(robloxUser: RobloxUser): string {
    if (robloxUser.displayName === robloxUser.name) {
        return robloxUser.name
    }

    return `${robloxUser.displayName} (@${robloxUser.name})`
}

function buildSuccessEmbed(robloxUser: RobloxUser | null, player: string, amount: number): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('<:Confirm:1315286412664508426> Pagamento Realizado com Sucesso!')
        .setThumbnail(SuccessEmojiUrl)
        .setTimestamp()
        .addFields(
            {
                name: '<:Roblox:1314141291621126165> Player:',
                value: `**${robloxUser ? formatRobloxName(robloxUser) : player}**`,
                inline: true,
            },
            {
                name: '<:Robux:1311957287178469447> Robux:',
                value: `**${amount}**`,
                inline: true,
            },
        )
}

const Command = {
    data: new SlashCommandBuilder()
        .setName('pagar')
        .setDescription('Enviar Robux pelo grupo configurado')
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
                .setName('player')
                .setDescription('Usuário ou ID do Roblox que receberá os Robux')
                .setRequired(true),
        )
        .addIntegerOption((Option) =>
            Option
                .setName('quantidade')
                .setDescription('Quantidade de Robux para enviar')
                .setRequired(true),
                ),

    async run(_Client: unknown, Interaction: any): Promise<void> {
        const BotOwnerId = process.env.BOT_OWNER

        if (!isUserAuthorized(Interaction.user.id, 'pagar', BotOwnerId)) {
            const Embed = new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('Acesso negado')
                .setDescription('Você não está autorizado(a) a usar este comando')

            await Interaction.reply({
                embeds: [Embed],
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const Player = Interaction.options.getString('player', true).trim()
        const Amount = Interaction.options.getInteger('quantidade', true)

        if (Amount <= 0) {
            await Interaction.reply({
                content: 'A quantidade precisa ser maior que zero',
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await Interaction.deferReply()

        try {
            let robloxUser: RobloxUser | null = null
            let avatarUrl: string | null = null

            try {
                robloxUser = await resolveRobloxUser(Player)
                avatarUrl = await getRobloxAvatarHeadshot(robloxUser.id)
            } catch (profileError) {
                console.warn('[PAGAR] Não foi possível carregar perfil Roblox do destinatário:', profileError)
            }

            if (robloxUser) {
                const eligibility = await getPayoutEligibility(robloxUser.id)

                if (eligibility.eligible === false) {
                    await Interaction.editReply({
                        embeds: [buildIneligibleEmbed(robloxUser, eligibility.raw)],
                    })
                    return
                }
            }

            const { stdout, stderr } = await runPagamentoScript(Player, Amount)
            const summary = summarizeOutput(stdout, stderr)
            const failureReason = buildFailureReason(stdout, stderr)
            const paymentSucceeded = getPaymentSucceeded(stdout, stderr)
            const profileUrl = robloxUser
                ? `https://www.roblox.com/users/${robloxUser.id}/profile`
                : null

            if (paymentSucceeded) {
                await Interaction.editReply({
                    embeds: [buildSuccessEmbed(robloxUser, Player, Amount)],
                })
                return
            }

            if (robloxUser && getPaymentRecipientIneligible(stdout, stderr)) {
                await Interaction.editReply({
                    embeds: [buildIneligibleEmbed(robloxUser)],
                })
                return
            }

            const Embed = new EmbedBuilder()
                .setColor(summary.color)
                .setTitle(summary.title)
                .setDescription(summary.description)
                .setFooter({ text: 'Pagamento de grupo Roblox' })
                .addFields(
                    {
                        name: 'Player',
                        value: robloxUser
                            ? `**${formatRobloxName(robloxUser)}**`
                            : `\`${Player}\``,
                        inline: true,
                    },
                    {
                        name: 'Enviado',
                        value: `\`${Amount}\``,
                        inline: true,
                    },
                    {
                        name: 'User ID',
                        value: robloxUser
                            ? `\`${robloxUser.id}\``
                            : '`Desconhecido`',
                        inline: true,
                    },
                )

            if (failureReason && summary.color !== 0x57f287) {
                Embed.addFields({
                    name: 'Motivo',
                    value: `\`${failureReason}\``,
                })
            }

            if (avatarUrl) {
                Embed.setThumbnail(avatarUrl)
            }

            if (profileUrl) {
                Embed.setURL(profileUrl)
            }

            await Interaction.editReply({
                embeds: [Embed],
            })
        } catch (error) {
            console.error('[PAGAR] Falha ao executar Pagamento.py:', error)

            const errorMessage = error instanceof Error
                ? error.message
                : String(error)

            const Embed = new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('Erro ao processar pagamento')
                .setDescription('Não foi possível executar o script de pagamento neste ambiente')
                .addFields({
                    name: 'Motivo',
                    value: `\`${errorMessage.slice(0, 250)}\``,
                })

            await Interaction.editReply({
                embeds: [Embed],
            })
        }
    },
}

export default Command



