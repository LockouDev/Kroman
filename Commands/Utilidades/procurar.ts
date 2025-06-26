import { InteractionContextType, EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, CommandInteraction, MessageFlags } from 'discord.js';
import noblox from 'noblox.js';
import https from 'https';

function delay(ms: number) {

  return new Promise(resolve => setTimeout(resolve, ms));

}

// Função para realizar requisição POST
function postRequest(url: string, data: any): Promise<any> {

  return new Promise((resolve, reject) => {

    const jsonData = JSON.stringify(data);
    const req = https.request(

      url,

      {

        method: 'POST',
        headers: {

          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonData),

        },

        timeout: 5000,

      },

      (res) => {

        let responseData = '';

        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => {

          try {

            resolve(JSON.parse(responseData));

          } catch (error) {

            reject(new Error('Erro ao analisar a resposta JSON'));

          }

        });

      }

    );

    req.on('error', (error) => reject(error));
    req.write(jsonData);
    req.end();

  });

}

// Função para realizar requisição GET
function getRequest(url: string): Promise<any> {

  return new Promise((resolve, reject) => {

    const req = https.request(

      url,

      {

        method: 'GET',
        headers: {

          'Content-Type': 'application/json',

        },

        timeout: 5000,

      },

      (res) => {

        let responseData = '';

        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => {

          try {

            resolve(JSON.parse(responseData));

          } catch (error) {

            reject(new Error('Erro ao analisar a resposta JSON'));

          }

        });

      }

    );

    req.on('error', (error) => reject(error));
    req.end();

  });

}

// Função para tentar buscar os dados com múltiplas tentativas
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, delayTime = 1000): Promise<T> {

  for (let attempt = 1; attempt <= retries; attempt++) {

    try {

      return await fn();

    } catch (error) {

      if (attempt < retries) await delay(delayTime);

    }

  }

  throw new Error('Erro ao buscar após múltiplas tentativas');

}

async function fetchAllDataUntilComplete(userId: number, maxRetries = 10, delayTime = 1500) {

  for (let attempt = 1; attempt <= maxRetries; attempt++) {

    try {

      const [

        info,
        thumb,
        headshot,
        presence,
        premium,
        friends,
        followers,
        followings

      ] = await Promise.all([

        fetchWithRetry(() => getRequest(`https://users.roblox.com/v1/users/${userId}`)),
        fetchWithRetry(() => getRequest(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`)),
        fetchWithRetry(() => getRequest(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=true`)),
        fetchWithRetry(() => postRequest('https://presence.roblox.com/v1/presence/users', { userIds: [userId] })),
        noblox.getPremium(userId),
        fetchWithRetry(() => getRequest(`https://friends.roblox.com/v1/users/${userId}/friends/count`)),
        fetchWithRetry(() => getRequest(`https://friends.roblox.com/v1/users/${userId}/followers/count`)),
        fetchWithRetry(() => getRequest(`https://friends.roblox.com/v1/users/${userId}/followings/count`))

      ]);

      const isValid =

        info &&
        thumb?.data?.[0]?.imageUrl &&
        headshot?.data?.[0]?.imageUrl &&
        typeof friends.count === 'number' &&
        typeof followers.count === 'number' &&
        typeof followings.count === 'number' &&
        presence?.userPresences?.[0] &&
        'userPresenceType' in presence.userPresences[0];

      if (isValid) {

        return {

          playerInfo: info,
          playerThumbnail: thumb,
          playerHSThumbnail: headshot,
          presenceInfo: presence.userPresences[0],
          premium,
          friendCount: friends.count,
          followerCount: followers.count,
          followingCount: followings.count

        };

      }

      console.log(`❌ Tentativa ${attempt}: dados incompletos`);

    } catch (error) {

      console.log(`❌ Erro na tentativa ${attempt}:`, error);

    }

    if (attempt < maxRetries) {

      await new Promise(resolve => setTimeout(resolve, delayTime * attempt));

    }

  }

  throw new Error('❌ Não foi possível obter todos os dados do jogador após várias tentativas');
  
}

module.exports = {

  data: new SlashCommandBuilder()
    .setName('procurar')
    .setDescription('Procurar um jogador no Roblox!')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Nickname do player')
        .setRequired(true)
    ),

  async run(client: any, interaction: any): Promise<void> {

    const player = interaction.options.getString('player');

    if (!player?.trim()) {

      return interaction.reply({ content: '❌ Nome de jogador inválido', ephemeral: true });

    }

    await interaction.deferReply();

    try {

      // 1. Obter o UserId do jogador
      const userResponse = await postRequest('https://users.roblox.com/v1/usernames/users', {

        usernames: [player],
        excludeBannedUsers: false,

      });

      const playerData = userResponse?.data?.[0];

      if (!playerData) {

        return interaction.editReply({

          embeds: [

            new EmbedBuilder()

              .setColor('#FB5151')
              .setTitle('<:ContentDeleted:1315331180521979904> Usuário não encontrado')
              .setDescription(`Parece que o jogador **${player}** não existe no Roblox`)

          ],

        });

      }

      const userId: number = playerData.id;

      // Inicia todas as requisições simultaneamente
      const {

        playerInfo,
        playerThumbnail,
        playerHSThumbnail,
        presenceInfo,
        premium,
        friendCount,
        followerCount,
        followingCount

      } = await fetchAllDataUntilComplete(userId);

      const joinDateUnix = Math.floor(new Date(playerInfo.created).getTime() / 1000);
      
      const presenceIcons: Record<number, string> = {

        0: '<:Offline:1315623606176190505>',
        1: '<:Online:1315623596730880001>',
        2: '<:Playing:1315623571619446784>',
        3: '<:Studio:1315623586903621632>'

      };

      const presenceTexts: Record<number, string> = {

        0: 'Offline',
        1: 'Online',
        2: 'Jogando',
        3: 'No Studio'

      };

      const presenceIcon = presenceIcons[presenceInfo.userPresenceType] || '<:Offline:1315623606176190505>';
      const presenceText = presenceTexts[presenceInfo.userPresenceType] || 'Desconhecido';

      const displayNameFormatted = playerInfo.name === playerInfo.displayName

        ? playerInfo.name
        : `${playerInfo.name} (${playerInfo.displayName})`;

      const banStatus = playerInfo.isBanned

        ? '<:Confirm:1315286412664508426> Sim'
        : '<:Decline:1315286423170977803> Não';

      const premiumStatus = premium

        ? '<:Confirm:1315286412664508426> Sim'
        : '<:Decline:1315286423170977803> Não';

      const description = playerInfo.description?.trim() || null;

      // Se o jogador estiver banido, constrói o embed apropriado
      if (playerInfo.isBanned) {

        const embed = new EmbedBuilder()

          .setColor('#FB5151')
          .setAuthor({ name: `Perfil de ${playerInfo.name}`, iconURL: 'https://img.icons8.com/ios11/200/FFFFFF/roblox.png' })
          .setTitle(`<:Locked:1315627104473186364> ${displayNameFormatted}`)
          .setThumbnail(playerThumbnail.data[0]?.imageUrl)
          .setDescription(description)
          .addFields(
            { name: '<:PlayerIcon:1315270644107182140> ID do Jogador', value: `\`${userId}\``, inline: false },
            { name: '<:ContentDeleted:1315331180521979904> Conta Banida', value: '<:Confirm:1315286412664508426> Sim', inline: false },
            { name: '<:DateAccount:1315278306425438248> Data de Criação', value: `<t:${joinDateUnix}:d>`, inline: false }
          )
          .setFooter({ text: displayNameFormatted, iconURL: playerHSThumbnail.data[0]?.imageUrl });

        return interaction.editReply({ embeds: [embed] });

      }

      // Constrói o embed para jogadores não banidos
      const embed = new EmbedBuilder()
        .setColor('#50FB5B')
        .setAuthor({ name: `Perfil de ${playerInfo.name}`, iconURL: 'https://img.icons8.com/ios11/200/FFFFFF/roblox.png' })
        .setTitle(`${presenceIcon} ${displayNameFormatted}`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setThumbnail(playerThumbnail.data[0]?.imageUrl)
        .setDescription(description)
        .addFields(
          { name: '<:PlayerIcon:1315270644107182140> ID do Jogador', value: `\`${userId}\``, inline: true },
          { name: '<:ContentDeleted:1315331180521979904> Conta Banida', value: banStatus, inline: true },
          { name: '<:Premium:1315261369955913728> Premium', value: premiumStatus, inline: true },
          { name: '<:DateAccount:1315278306425438248> Data de Criação', value: `<t:${joinDateUnix}:d>`, inline: true },
          { name: '<:CreatedAccount:1315277832871739413> Idade da Conta', value: `${Math.floor((Date.now() - new Date(playerInfo.created).getTime()) / (1000 * 60 * 60 * 24))} dias` || 'N/A', inline: true },
          { name: `${presenceIcon} Status`, value: presenceText, inline: true },
          { name: '<:Friends:1315278590685745205> Total de Amigos', value: `${friendCount}`, inline: true },
          { name: '<:Followers:1315279069029601371> Seguidores', value: `${followerCount}`, inline: true },
          { name: '<:Following:1315280134244401204> Seguindo', value: `${followingCount}`, inline: true }
        )
        .setFooter({ text: displayNameFormatted, iconURL: playerHSThumbnail.data[0]?.imageUrl });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {

      console.error('❌ Erro ao buscar informações do jogador:', error);

      await interaction.editReply({

        content: '<:Roblox:1314141291621126165> Ocorreu um erro ao buscar as informações. Tente novamente mais tarde',
        ephemeral: true,

      });

    }

  }

}