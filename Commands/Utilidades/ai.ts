import 'dotenv/config';
import { Client, CommandInteraction, InteractionContextType, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ApplicationIntegrationType, Attachment, MessageFlags } from 'discord.js';
import { GoogleGenAI, Operations } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'node:fs';
import path from 'path'
import mime from 'mime-types';
import axios from 'axios';
import sharp from 'sharp';
import { writeFile } from 'fs/promises';
import fetch from 'node-fetch';

type ChatPart = { text?: string; fileData?: FileData };

type ChatHistory = {
    role: string;
    parts: ChatPart[];
}[];

type ConversationMessage = {

    role: string;
    parts: { text: string }[];

};

const conversationMemory = new Map<string, ConversationMessage[]>();

async function removeBG(blob: any): Promise<Buffer> {

    const formData = new FormData();

    formData.append('size', 'auto');
    formData.append('image_file', new Blob([blob]));

    const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {

        headers: {
            'X-Api-Key': process.env.REMOVEBG_KEY!,
            ...axios.defaults.headers.common,
        },

        responseType: 'arraybuffer',

    });

    if (response.status === 200) {

        return Buffer.from(response.data);

    } else {

        throw new Error(`RemoveBG error: ${response.status} - ${response.statusText}`);

    }

}

async function generateText(prompt: string, userId: string): Promise<string> {

    const apiKey = process.env.AI_KEY;

    if (!apiKey) throw new Error('API Key não definida');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
    const generationConfig = {

        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 65536,
        responseModalities: [],
        responseMimeType: "text/plain",

    };

    // Mantém o histórico de conversa para contexto (opcional)
    if (!conversationMemory.has(userId)) {

        conversationMemory.set(userId, []);

    }

    const history = conversationMemory.get(userId)!;

    // Cria o histórico formatado para o chat
    const sessionHistory = history.map((msg) => ({

        role: msg.role,
        parts: msg.parts,

    }));

    // Inicia a sessão e envia o prompt
    const chatSession = model.startChat({

        generationConfig,
        history: sessionHistory,

    });

    const result = await chatSession.sendMessage(prompt);
    const candidates = result.response?.candidates ?? [];
    const responseText = candidates[0]?.content?.parts[0]?.text || '❌ Resposta vazia da IA';

    // Atualiza o histórico (limpa se ultrapassar determinado tamanho)
    history.push({ role: 'user', parts: [{ text: prompt }] });
    history.push({ role: 'model', parts: [{ text: responseText }] });

    if (history.length > 10) history.splice(0, 2);

    return responseText;

}

interface FileData {

    mimeType: string;
    fileUri: string;

}

async function generateImage(prompt: string, fileData?: FileData): Promise<{ buffer: Buffer; filename: string }> {

    const apiKey = process.env.AI_KEY;

    if (!apiKey) throw new Error("API key não definida");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp-image-generation" });

    const generationConfig = {

        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseModalities: ["image", "text"],
        responseMimeType: "text/plain",

    };

    const chatHistory: ChatHistory = [{

        role: "user",
        parts: fileData ? [{ text: prompt }, { fileData }] : [{ text: prompt }]

    }];

    const result = await model.generateContent({
        contents: [{
            role: "user",
            parts: fileData ? [{ text: prompt }, { fileData }] : [{ text: prompt }]
        }],
        generationConfig,
    });

    const candidates = result.response?.candidates ?? [];

    // Procura por conteúdo com dados inline (imagem)
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {

        const candidate = candidates[candidateIndex];

        for (let partIndex = 0; partIndex < candidate.content.parts.length; partIndex++) {

            const part = candidate.content.parts[partIndex];

            if (part.inlineData) {

                try {

                    const ext = mime.extension(part.inlineData.mimeType);
                    const filename = `output_${candidateIndex}_${partIndex}.${ext}`;
                    const buffer = Buffer.from(part.inlineData.data, 'base64');

                    return { buffer, filename };

                } catch (err) {

                    console.error(err);
                    throw new Error('Erro ao processar a imagem gerada');

                }

            }

        }

    }

    throw new Error('Nenhuma imagem foi gerada para o prompt fornecido');

}

async function downloadAttachment(url: string, filename: string): Promise<string> {

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const filePath = path.join(__dirname, filename);

    fs.writeFileSync(filePath, Buffer.from(response.data));

    return filePath;

}

async function sendResponse(interaction: CommandInteraction, response: string) {

    const chunkSize = 2000;
    const chunks = response.match(new RegExp(`[\\s\\S]{1,${chunkSize}}`, 'g')) || [];

    // Envia o primeiro chunk como edição da resposta e os demais como followUp
    await interaction.editReply(chunks.shift()!);

    for (const chunk of chunks) {

        await interaction.followUp(chunk);

    }

}

module.exports = {

    data: new SlashCommandBuilder()

        .setName('ai')
        .setDescription('Interaja com a IA')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .addSubcommand(subcommand =>
            subcommand
                .setName('chat')
                .setDescription('Interaja com a IA')
                .addStringOption(option =>
                    option
                        .setName('prompt')
                        .setDescription('O que deseja falar?')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('gerar')
                .setDescription('Gerar uma imagem com a IA')
                .addStringOption(option =>
                    option
                        .setName('prompt')
                        .setDescription('O que deseja gerar?')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option
                        .setName('transparente')
                        .setDescription('Remover o fundo da imagem (transparente)?')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pesquisar')
                .setDescription('Procurar algo na web')
                .addStringOption(option =>
                    option
                        .setName('prompt')
                        .setDescription('O que deseja buscar?')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('alterar')
                .setDescription('Alterar uma imagem com a IA')
                .addAttachmentOption(option =>
                    option
                        .setName('image1')
                        .setDescription('Imagem base 1')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('prompt')
                        .setDescription('O que deseja alterar?')
                        .setRequired(true)
                )
                .addAttachmentOption(option =>
                    option
                        .setName('image2')
                        .setDescription('Imagem base 2')
                        .setRequired(false)
                )
        ),
    /**.addSubcommand(subcommand =>
        subcommand
            .setName('video')
            .setDescription('Gerar um vídeo com a IA')
            .addStringOption(option =>
                option
                    .setName('prompt')
                    .setDescription('O que deseja gerar?')
                    .setRequired(true)
            )
            .addAttachmentOption(option =>
                option
                    .setName('imagem')
                    .setDescription('Imagem base')
                    .setRequired(false)
            )
    ),*/


    async run(client: Client, interaction: any): Promise<void> {

        const action = interaction.options.getString('action') || 'text';
        const attachmentOption = interaction.options.getAttachment('attachment');
        const userId = interaction.user.id;

        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();
        const prompt = interaction.options.getString('prompt')!;

        try {

            if (sub === 'chat') {

                const responseText = await generateText(prompt, userId);
                await sendResponse(interaction, responseText);

                return;

            }

            if (sub === 'pesquisar') {

                // Busca na web utilizando a API do Brave
                const braveResponse = await axios.get(

                    `https://api.search.brave.com/res/v1/web/search`,

                    {

                        params: { q: prompt },
                        headers: {

                            'Accept': 'application/json',
                            'Accept-Encoding': 'gzip',
                            'X-Subscription-Token': process.env.BRAVE_KEY || '',

                        },

                    }

                );

                const results = braveResponse.data.web?.results || [];

                let responseText: string;

                const embed = new EmbedBuilder()

                    .setTitle(`Resultados para: "${prompt}"`)
                    .setColor(0x00AE86)
                    .setTimestamp();

                if (results.length === 0) {

                    embed.setDescription('❌ Não foram encontrados resultados para sua pesquisa');

                } else {

                    results.slice(0, 5).forEach((r: any, i: number) => {

                        embed.addFields({

                            name: `${i + 1}. ${r.title}`,
                            value: `[Abrir link](${r.url})\n${r.description || '*Sem descrição*'}`,

                        });

                    });

                }

                await interaction.editReply({ embeds: [embed] });

                return;

            }

            if (sub === 'gerar') {

                const transparente = interaction.options.getBoolean('transparente') || false;

                try {

                    const { buffer, filename } = await generateImage(prompt);

                    let processedBuffer = buffer;

                    if (transparente) {

                        try {

                            processedBuffer = await removeBG(buffer);

                        } catch (removeBGError) {

                            console.warn('Erro ao aplicar RemoveBG:', removeBGError);
                            await interaction.followUp('⚠️ Não foi possível remover o fundo da imagem');

                        }

                    }

                    const attachment = new AttachmentBuilder(processedBuffer, { name: filename });
                    await interaction.editReply({ files: [attachment] });

                } catch (error) {

                    console.error('Erro ao gerar imagem:', error);
                    await interaction.editReply('❌ Ocorreu um erro ao gerar a imagem');

                }

                return;

            }

            if (sub === 'alterar') {

                const attachment1 = interaction.options.getAttachment('image1')!;
                const attachment2 = interaction.options.getAttachment('image2');

                const filePath1 = await downloadAttachment(attachment1.url, attachment1.name);

                const fileManager = new GoogleAIFileManager(process.env.AI_KEY!);

                const uploadFile1 = await fileManager.uploadFile(filePath1, {

                    mimeType: attachment1.contentType!,
                    displayName: attachment1.name,

                });

                fs.unlinkSync(filePath1);

                let fileData: FileData = {

                    mimeType: uploadFile1.file.mimeType,
                    fileUri: uploadFile1.file.uri,

                };

                if (attachment2) {

                    const filePath2 = await downloadAttachment(attachment2.url, attachment2.name);
                    const uploadFile2 = await fileManager.uploadFile(filePath2, {

                        mimeType: attachment2.contentType!,
                        displayName: attachment2.name,

                    });

                    fs.unlinkSync(filePath2);

                }

                const { buffer, filename } = await generateImage(prompt, fileData);

                let respostaBuffer = buffer;

                if (attachment1.contentType === 'image/png') {

                    const hasAlpha = await sharp(buffer)
                        .metadata()
                        .then(metadata => metadata.hasAlpha);

                    if (hasAlpha) {

                        respostaBuffer = await sharp(buffer)
                            .ensureAlpha()
                            .png()
                            .joinChannel(

                                await sharp(buffer)
                                    .threshold(25)
                                    .toColorspace('b-w')
                                    .toBuffer()

                            )

                            .toBuffer();

                    }

                }

                const attachment = new AttachmentBuilder(respostaBuffer, { name: filename });
                await interaction.editReply({ files: [attachment] });

                return;

            }

            /** if (sub === 'video') {
 
                 const ai = new GoogleGenAI({ apiKey: process.env.AI_KEY! });
                 const imagemOpt = interaction.options.getAttachment('imagem');
 
                 let promptFinal = prompt;
 
                 let imageParam: { imageBytes: string; mimeType: string } | undefined;
 
                 if (imagemOpt) {
 
                     const tmpImg = await downloadAttachment(imagemOpt.url, imagemOpt.name);
                     const buffer = fs.readFileSync(tmpImg);
 
                     fs.unlinkSync(tmpImg);
 
                     imageParam = { imageBytes: buffer.toString('base64'), mimeType: imagemOpt.contentType! };
 
                     promptFinal = `Com base nesta imagem, ${prompt}`;
 
                 }
 
                 let op = await ai.models.generateVideos({
 
                     model: 'veo-2.0-generate-001',
                     prompt: promptFinal,
                     image: imageParam,
                     config: {
 
                         numberOfVideos: 1,
                         aspectRatio: '16:9',
                         durationSeconds: 8,
                         personGeneration: 'dont_allow',
 
                     },
 
                 });
 
                 while (!op.done) {
 
                     await new Promise(r => setTimeout(r, 10000));
 
                     op = await ai.operations.getVideosOperation({ op: op });
 
                 }
 
                 const vid = op.response?.generatedVideos?.[0]?.video;
 
                 if (vid?.uri) {
 
                     const res = await fetch(`${vid.uri}&key=${process.env.AI_KEY}`);
                     const buf = await res.arrayBuffer();
                     const fileName = `video_${Date.now()}.mp4`;
 
                     await writeFile(fileName, Buffer.from(buf));
                     await interaction.editReply({ files: [{ attachment: fileName, name: fileName }] });
 
                 } else {
 
                     await interaction.editReply('❌ Falha ao gerar vídeo');
 
                 }
 
                 return;
                 
         }*/

        } catch (error) {

            console.error('Erro:', error);

            await interaction.editReply('❌ Ocorreu um erro ao processar sua solicitação');

        }

    },

};