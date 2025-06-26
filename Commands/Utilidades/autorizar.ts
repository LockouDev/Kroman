import 'dotenv/config';
import {
  InteractionContextType,
  SlashCommandBuilder,
  CommandInteraction,
  ApplicationIntegrationType,
  CacheType,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'Registro', 'autorizacoes.json');
const commandDirectory = path.resolve(__dirname, '..');

interface Authorization {
  userId: string;
  commandName: string;
}

const allowedCommands = ['checar', 'fundos', 'pagar', 'gerarpix', 'tabela']

function ensureFileExists() {

  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {

    fs.mkdirSync(dirPath, { recursive: true }); // Cria o diretório, se necessário

  }

  if (!fs.existsSync(filePath)) {

    fs.writeFileSync(filePath, '[]', 'utf-8'); // Cria o arquivo vazio, se necessário

  }

}

function loadAuthorizations(): Authorization[] {

  ensureFileExists();
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);

}

function saveAuthorizations(data: Authorization[]) {

  ensureFileExists();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');

}

function listAvaibleCommands(): string[] {

  const files = fs.readdirSync(commandDirectory);

  return files
    .filter((files) => files.endsWith('.ts') || files.endsWith('.js'))
    .map((file) => file.replace(/\.[jt]s$/, ''));

}

const authorizations: Authorization[] = loadAuthorizations();

module.exports = {

  data: new SlashCommandBuilder()
    .setName('autorizar')
    .setDescription('Gerencie permissões para outros comandos')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand(subcommand => subcommand
      .setName('adicionar')
      .setDescription('Autoriza um usuário a usar um comando')
      .addStringOption(option => option
        .setName('usuario')
        .setDescription('ID do usuário a ser autorizado')
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName('comando')
        .setDescription('Nome do comando a ser autorizado')
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName('remover')
      .setDescription('Remove uma autorização de um usuário')
      .addStringOption(option => option
        .setName('usuario')
        .setDescription('ID do usuário a ser desautorizado')
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName('comando')
        .setDescription('Nome do comando a ser desautorizado')
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName('lista')
      .setDescription('Lista de todas as autorizações')
    ),

  async run(client: any, interaction: CommandInteraction<CacheType>) {

    const botOwnerId = process.env.BOT_OWNER;

    if (interaction.user.id !== botOwnerId) {

      const embed = new EmbedBuilder()
        .setTitle('❌ Acesso Negado')
        .setDescription('❌ Apenas o proprietário pode usar este comando')
        .setColor('Red');

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    }

    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'adicionar') {

      const userId = interaction.options.getString('usuario', true);
      const commandName = interaction.options.getString('comando', true);

      if (!allowedCommands.includes(commandName)) {

        const embed = new EmbedBuilder()
          .setTitle('❌ Comando Inválido')
          .setDescription(`O comando **${commandName}** não está na lista de comandos autorizáveis`)
          .setColor('Red');

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

      }

      const existingAuthorization = authorizations.find(

        (auth) => auth.userId === userId && auth.commandName === commandName

      );

      if (existingAuthorization) {

        const embed = new EmbedBuilder()
          .setTitle('❌ Autorização já Existe')
          .setDescription(`Usuário <@${userId}> já está autorizado a usar o comando **${commandName}**`)
          .setColor('Yellow');

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

      }

      const newAuthorization = { userId, commandName };
      authorizations.push(newAuthorization);
      saveAuthorizations(authorizations);

      const embed = new EmbedBuilder()
        .setTitle('✅ Autorização Adicionada')
        .setDescription(`Usuário <@${userId}> foi autorizado a usar o comando **${commandName}**`)
        .setColor('Green');

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'remover') {

      const userId = interaction.options.getString('usuario', true);
      const commandName = interaction.options.getString('comando', true);

      const index = authorizations.findIndex(

        (auth) => auth.userId === userId && auth.commandName === commandName

      );

      if (index === -1) {

        const embed = new EmbedBuilder()
          .setTitle('❌ Autorização Não Encontrada')
          .setDescription(`Nenhuma autorização encontrada para o usuário <@${userId}> no comando **${commandName}**`)
          .setColor('Red');

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

      }

      authorizations.splice(index, 1);
      saveAuthorizations(authorizations);

      const embed = new EmbedBuilder()
        .setTitle('✅ Autorização Removida')
        .setDescription(`Autorização para o usuário <@${userId}> usar o comando **${commandName}** foi removida`)
        .setColor('Green');

      return interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'lista') {

      const embed = new EmbedBuilder()
        .setTitle('📋 Lista de Autorizações');

      if (authorizations.length === 0) {

        embed.setDescription('Nenhuma autorização encontrada').setColor('Yellow');

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

      }

      const list = authorizations
        .map(
          (auth) =>
            `- <@${auth.userId}> (ID: ${auth.userId}) - Comando: **${auth.commandName}**`
        )
        .join('\n');

        embed.setDescription(list).setColor('Blue');

      return interaction.reply({ embeds: [embed] });

    }

  },

};