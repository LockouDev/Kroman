require('dotenv').config();
const { InteractionContextType, EmbedBuilder, SlashCommandBuilder, AttachmentBuilder, ApplicationIntegrationType } = require('discord.js');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { buffer } = require('stream/consumers');

const filePath = path.join(process.cwd(), 'Registro', 'autorizacoes.json');

function loadAuthorizations() {

    if (!fs.existsSync(filePath)) {

        fs.writeFileSync(filePath, '[]', 'utf-8');

    }

    const data = fs.readFileSync(filePath, 'utf-8');

    return JSON.parse(data);

}

module.exports = {

    data: new SlashCommandBuilder()
        .setName('gerarpix')
        .setDescription('Gerar pix')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)

        .addNumberOption(option => option.setName('valor')

            .setDescription('Valor em Real Brasileiro')
            .setRequired(true)

        )

        .addStringOption(option => option.setName('descricao')

            .setDescription('Descrição do PIX')
            .setRequired(true)

        ),


    async run(client, interaction) {

        const botOwnerId = process.env.BOT_OWNER;

        const authorizations = loadAuthorizations();
        const isAuthorized =
            interaction.user.id === botOwnerId ||
            authorizations.some(

                (auth) => auth.userId === interaction.user.id && auth.commandName === 'gerarpix'

            );

        if (!isAuthorized) {

            const embed = new EmbedBuilder()

                .setColor('Red')
                .setTitle('❌ Acesso Negado')
                .setDescription('Você não está autorizado(a) a usar este comando. Solicite permissão ao proprietário do bot');

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

        const amount = interaction.options.getNumber('valor');

        if (amount <= 0) {

            return interaction.reply({ content: '❌ O valor deve ser maior que zero', ephemeral: true });

        }

        const desc = interaction.options.getString('descricao');

        const mpClient = new MercadoPagoConfig({

            accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
            options: { timeout: 5000 }

        });

        const payment = new Payment(mpClient);

        const body = {

            transaction_amount: amount,
            description: desc,
            payment_method_id: 'pix',

            payer: {

                email: process.env.MERCADO_PAGO_EMAIL

            }

        };

        try {

            await interaction.deferReply();

            const response = await payment.create({ body }).catch(error => {

                console.error('[ERROR] Erro na solicitação à API Mercado Pago:', error);

                throw new Error('Falha na solicitação ao Mercado Pago. Verifique as credenciais e os parâmetros');

            });

            //console.log('[DEBUG] Resposta completa da API Mercado Pago:', response);

            const point_of_interaction = response.point_of_interaction;

            const transactionData = point_of_interaction.transaction_data;

            const qrCode = transactionData.qr_code_base64;
            const copyPaste = transactionData.qr_code

            const qrCodePath = path.join(__dirname, 'qrcode.png');
            const qrCodeBuffer = Buffer.from(qrCode, 'base64');

            await sharp(qrCodeBuffer)
                .resize(256, 256)
                .toFile(qrCodePath);

            //fs.writeFileSync(qrCodePath, qrCodeBuffer);

            const attachment = new AttachmentBuilder(qrCodePath);

            const embed = new EmbedBuilder()

                .setColor('#4DB6AC')
                .setTitle(`<:pix:1313180220462862346> **Valor:** R$${amount.toFixed(2)}`)
                .setDescription(`**PIX Copiar & Colar**\n\`\`\`${copyPaste}\`\`\``)
                .addFields([{ name: '**Descrição do Pagamento:**', value: `\`\`${desc}\`\``, inline: false }])
                .setImage(`attachment://qrcode.png`)

            await interaction.editReply({ embeds: [embed], files: [attachment] });

            fs.unlinkSync(qrCodePath);

        } catch (error) {

            console.error('[ERROR] Falha ao gerar o pagamento via Pix:', error);

            await interaction.editReply({

                content: '❌ Ocorreu um erro ao tentar gerar o pagamento via Pix. Tente novamente mais tarde',
                ephemeral: true

            });

        }

    }

}