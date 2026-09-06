import {
    ApplicationIntegrationType,
    AttachmentBuilder,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder,
    type Attachment,
    type ChatInputCommandInteraction,
} from 'discord.js';
import Dotenv from 'dotenv';
import Path from 'node:path';
import { fileURLToPath } from 'node:url';
import Sharp from 'sharp';

type OcrParsedResult = {
    ParsedText?: string | null;
    ErrorMessage?: string | string[] | null;
    ErrorDetails?: string | null;
};

type OcrApiResponse = {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[] | null;
    ErrorDetails?: string | null;
    ParsedResults?: OcrParsedResult[];
};

const OCR_ENDPOINT = 'https://api.ocr.space/parse/image';
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tif', 'tiff', 'pdf']);
const ProjectRoot = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Uses the bot root instead of PM2's current directory when loading the API key
Dotenv.config({
    path: Path.join(ProjectRoot, '.env'),
    override: false,
    quiet: true,
});

function getExtension(attachment: Attachment): string {
    const filename = attachment.name ?? '';
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';

    return extension;
}

function formatApiError(value: string | string[] | null | undefined): string {
    if (Array.isArray(value)) {
        return value.join(' ');
    }

    return value?.trim() || 'A API não informou o motivo';
}

function getParsedText(result: OcrApiResponse): string {
    const parsedText = result.ParsedResults
        ?.map((page) => page.ParsedText?.trim())
        .filter((text): text is string => Boolean(text))
        .join('\n\n');

    if (parsedText) {
        return parsedText;
    }

    const pageError = result.ParsedResults
        ?.map((page) => formatApiError(page.ErrorMessage ?? page.ErrorDetails))
        .find((message) => message !== 'A API não informou o motivo');

    throw new Error(pageError ?? formatApiError(result.ErrorMessage ?? result.ErrorDetails));
}

function formatPreview(text: string): string {
    const maximumLength = 3_700;
    const safeText = text.replace(/```/g, '``\\`');

    if (safeText.length <= maximumLength) {
        return `\`\`\`\n${safeText}\n\`\`\``;
    }

    return `\`\`\`\n${safeText.slice(0, maximumLength)}\n…\n\`\`\``;
}

async function prepareOcrFile(attachment: Attachment): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
    wasCompressed: boolean;
}> {
    const fileResponse = await fetch(attachment.url);

    if (!fileResponse.ok) {
        throw new Error('Não foi possível baixar a imagem enviada');
    }

    const originalBuffer = Buffer.from(await fileResponse.arrayBuffer());

    if (originalBuffer.byteLength <= MAX_FILE_SIZE_BYTES) {
        return {
            buffer: originalBuffer,
            filename: attachment.name ?? `imagem.${getExtension(attachment) || 'png'}`,
            contentType: attachment.contentType ?? 'application/octet-stream',
            wasCompressed: false,
        };
    }

    if (getExtension(attachment) === 'pdf') {
        throw new Error('PDFs acima de 1 MB precisam ser reduzidos antes do envio');
    }

    const compressionProfiles = [
        { size: 2_400, quality: 90 },
        { size: 2_000, quality: 85 },
        { size: 1_600, quality: 80 },
        { size: 1_200, quality: 75 },
        { size: 1_000, quality: 70 },
    ];

    try {
        for (const profile of compressionProfiles) {
            const compressedBuffer = await Sharp(originalBuffer, {
                limitInputPixels: 40_000_000,
            })
                .rotate()
                .resize({
                    width: profile.size,
                    height: profile.size,
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .flatten({ background: '#FFFFFF' })
                .jpeg({ quality: profile.quality, mozjpeg: true })
                .toBuffer();

            if (compressedBuffer.byteLength <= MAX_FILE_SIZE_BYTES) {
                return {
                    buffer: compressedBuffer,
                    filename: 'ocr-imagem.jpg',
                    contentType: 'image/jpeg',
                    wasCompressed: true,
                };
            }
        }
    } catch {
        throw new Error('Não foi possível otimizar essa imagem para o OCR');
    }

    throw new Error('A imagem continua maior que 1 MB mesmo após a otimização');
}

async function extractText(attachment: Attachment, apiKey: string): Promise<{
    text: string;
    wasCompressed: boolean;
}> {
    const file = await prepareOcrFile(attachment);
    const blobBuffer = new ArrayBuffer(file.buffer.byteLength);
    new Uint8Array(blobBuffer).set(file.buffer);
    const form = new FormData();
    form.append('file', new Blob([blobBuffer], { type: file.contentType }), file.filename);
    form.append('language', 'por');
    form.append('OCREngine', '2');
    form.append('detectOrientation', 'true');
    form.append('scale', 'true');
    form.append('isOverlayRequired', 'false');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
        const response = await fetch(OCR_ENDPOINT, {
            method: 'POST',
            headers: {
                apikey: apiKey,
            },
            body: form,
            signal: controller.signal,
        });

        const result = await response.json().catch(() => null) as OcrApiResponse | null;

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Limite de requisições da OCR.space atingido, tente novamente mais tarde');
            }

            throw new Error(result ? formatApiError(result.ErrorMessage ?? result.ErrorDetails) : `A API retornou HTTP ${response.status}`);
        }

        if (!result || result.IsErroredOnProcessing) {
            throw new Error(formatApiError(result?.ErrorMessage ?? result?.ErrorDetails));
        }

        return {
            text: getParsedText(result),
            wasCompressed: file.wasCompressed,
        };
    } finally {
        clearTimeout(timeout);
    }
}

const Command = {
    data: new SlashCommandBuilder()
        .setName('ocr')
        .setDescription('Lê o texto de uma imagem ou PDF')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .addAttachmentOption((option) =>
            option
                .setName('imagem')
                .setDescription('Imagem ou PDF contendo o texto')
                .setRequired(true),
        ),

    async run(_client: unknown, interaction: ChatInputCommandInteraction): Promise<void> {
        const attachment = interaction.options.getAttachment('imagem', true);
        const apiKey = process.env.OCR_KEY?.trim();

        if (!apiKey) {
            await interaction.reply({
                content: 'OCR_KEY não está configurada no ambiente',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const extension = getExtension(attachment);

        if (!SUPPORTED_EXTENSIONS.has(extension)) {
            await interaction.reply({
                content: 'Envie uma imagem PNG, JPG, GIF, BMP, TIFF ou um PDF',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply();

        try {
            const result = await extractText(attachment, apiKey);
            const parsedText = result.text;
            const isLongText = parsedText.length > 3_700;
            const files = isLongText
                ? [new AttachmentBuilder(Buffer.from(parsedText, 'utf-8'), { name: 'ocr-texto.txt' })]
                : [];

            const embed = new EmbedBuilder()
                .setColor('#98F768')
                .setTitle('Texto identificado')
                .setDescription(formatPreview(parsedText))
                .setFooter({
                    text: isLongText
                        ? 'O texto completo está anexado em ocr-texto.txt'
                        : result.wasCompressed
                            ? 'A imagem foi otimizada antes da leitura'
                            : `Arquivo: ${attachment.name ?? 'imagem'}`,
                });

            await interaction.editReply({ embeds: [embed], files });
        } catch (error) {
            console.error('[OCR] Erro ao ler arquivo:', error);

            const message = error instanceof Error
                ? error.name === 'AbortError'
                    ? 'A leitura demorou demais e foi cancelada'
                    : error.message
                : 'Erro desconhecido';

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FF4D5A')
                        .setTitle('Não foi possível ler o arquivo')
                        .setDescription(message),
                ],
            });
        }
    },
};

export default Command;
