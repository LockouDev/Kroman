import {
    ApplicationIntegrationType,
    AttachmentBuilder,
    EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from 'discord.js';

type CatalogDetails = {
    AssetId: number;
    Name: string;
    AssetTypeId: number;
    Creator?: {
        Name?: string;
    };
};

const RobloxCookie = process.env.COOKIE?.trim() ?? null;

function getAssetTypeLabel(assetTypeId: number): string {
    if (assetTypeId === 11) {
        return 'Camisa';
    }

    if (assetTypeId === 12) {
        return 'Calça';
    }

    if (assetTypeId === 2) {
        return 'Camiseta';
    }

    return `Asset ${assetTypeId}`;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);

    if (!response.ok) {
        throw new Error(`GET ${url} retornou ${response.status}`);
    }

    return (await response.json()) as T;
}

async function getText(url: string, init?: RequestInit): Promise<string> {
    const response = await fetch(url, init);

    if (!response.ok) {
        throw new Error(`GET ${url} retornou ${response.status}`);
    }

    return await response.text();
}

async function getBuffer(url: string, init?: RequestInit): Promise<Buffer> {
    const response = await fetch(url, init);

    if (!response.ok) {
        throw new Error(`GET ${url} retornou ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

function extractTemplateAssetId(assetBody: string, assetTypeId: number): number | null {
    const propertyName = assetTypeId === 11
        ? 'ShirtTemplate'
        : assetTypeId === 12
            ? 'PantsTemplate'
            : '';

    if (!propertyName) {
        return null;
    }

    const propertyRegex = new RegExp(
        `<Content[^>]*name="${propertyName}"[^>]*>\\s*<url>https?:\\/\\/(?:www\\.)?roblox\\.com\\/asset\\/\\?id=(\\d+)`,
        'i',
    );
    const propertyMatch = assetBody.match(propertyRegex);

    if (propertyMatch) {
        return Number(propertyMatch[1]);
    }

    const genericRegex = /https?:\/\/(?:www\.)?roblox\.com\/asset\/\?id=(\d+)/gi;
    const matches = [...assetBody.matchAll(genericRegex)];

    if (matches.length === 0) {
        return null;
    }

    return Number(matches[matches.length - 1][1]);
}

async function resolveClothingImage(catalogId: number): Promise<{
    details: CatalogDetails;
    templateAssetId: number;
    templateBuffer: Buffer;
}> {
    const details = await getJson<CatalogDetails>(`https://economy.roblox.com/v2/assets/${catalogId}/details`);

    if (![11, 12].includes(details.AssetTypeId)) {
        throw new Error('Esse ID nao e de uma roupa classica (Shirt ou Pants)');
    }

    if (!RobloxCookie) {
        throw new Error('COOKIE nao configurado no ambiente');
    }

    const assetBody = await getText(`https://assetdelivery.roblox.com/v1/asset/?id=${catalogId}`, {
        headers: {
            Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
            Referer: 'https://www.roblox.com/',
            'User-Agent': 'Mozilla/5.0',
        },
    });

    const templateAssetId = extractTemplateAssetId(assetBody, details.AssetTypeId);

    if (!templateAssetId) {
        throw new Error('Nao foi possivel localizar o template da roupa');
    }

    const templateBuffer = await getBuffer(`https://assetdelivery.roblox.com/v1/asset/?id=${templateAssetId}`, {
        headers: {
            Cookie: `.ROBLOSECURITY=${RobloxCookie}`,
            Referer: 'https://www.roblox.com/',
            'User-Agent': 'Mozilla/5.0',
        },
    });

    return {
        details,
        templateAssetId,
        templateBuffer,
    };
}

const Command = {
    data: new SlashCommandBuilder()
        .setName('roupa')
        .setDescription('Pega a imagem 2D de uma roupa clássica do Roblox')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .addStringOption((Option) =>
            Option
                .setName('id')
                .setDescription('ID da roupa no catálogo do Roblox')
                .setRequired(true),
        ),

    async run(_Client: unknown, Interaction: ChatInputCommandInteraction): Promise<void> {
        const RawId = Interaction.options.getString('id', true).trim();
        const CatalogId = Number(RawId);

        if (!Number.isInteger(CatalogId) || CatalogId <= 0) {
            await Interaction.reply({
                content: 'Informe um ID valido da roupa',
                ephemeral: true,
            });
            return;
        }

        await Interaction.deferReply();

        try {
            const result = await resolveClothingImage(CatalogId);
            const assetTypeLabel = getAssetTypeLabel(result.details.AssetTypeId);
            const creatorName = result.details.Creator?.Name ?? 'Desconhecido';
            const attachment = new AttachmentBuilder(result.templateBuffer, {
                name: `roupa-${result.templateAssetId}.png`,
            });

            const embed = new EmbedBuilder()
                .setColor('#50FB5B')
                .setTitle(result.details.Name)
                .setURL(`https://www.roblox.com/catalog/${result.details.AssetId}`)
                .setDescription(
                    `Tipo: **${assetTypeLabel}**\n` +
                    `Criador: **${creatorName}**\n` +
                    `Template ID: \`${result.templateAssetId}\``,
                )
                .setImage(`attachment://roupa-${result.templateAssetId}.png`)
                .setFooter({ text: `Catalog ID: ${result.details.AssetId}` });

            await Interaction.editReply({
                embeds: [embed],
                files: [attachment],
            });
        } catch (error) {
            console.error('[ROUPA] Erro ao buscar roupa:', error);

            const message = error instanceof Error ? error.message : 'Erro desconhecido';

            await Interaction.editReply({
                content: `Nao foi possivel buscar essa roupa\nMotivo: ${message}`,
            });
        }
    },
};

export default Command;
