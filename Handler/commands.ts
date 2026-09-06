import 'dotenv/config';
import { REST, Routes, Collection } from 'discord.js';
import { promises as Fs } from 'node:fs';
import Path from 'node:path';
import { pathToFileURL } from 'node:url';

type CommandModule = {
    data?: {
        name: string;
        guildOnly?: boolean;
        toJSON: () => Record<string, any>;
    };
    run?: (Client: any, Interaction: any) => Promise<unknown> | unknown;
};

type CommandData = Record<string, any>;

export default async function CommandsHandler(Client: any): Promise<void> {
    const Token = process.env.DISCORD_BOT_TOKEN;
    const ClientId = process.env.DISCORD_CLIENT_ID;

    if (!Token || !ClientId) {
        console.error('[COMMANDS] DISCORD_BOT_TOKEN e DISCORD_CLIENT_ID sao obrigatorios.');
        return;
    }

    const Rest = new REST({ version: '10' }).setToken(Token);
    const LocalSlashCommands = new Collection<string, CommandModule>();
    const GlobalSlashCommands = new Collection<string, CommandModule>();
    const LoadedLocalCommands: CommandData[] = [];
    const LoadedGlobalCommands: CommandData[] = [];
    let HasCommandLoadFailure = false;

    try {
        const CommandsRoot = Path.resolve(process.cwd(), 'Commands');
        const Folders = await Fs.readdir(CommandsRoot, { withFileTypes: true });

        for (const Folder of Folders) {
            if (!Folder.isDirectory()) {
                continue;
            }

            const FolderPath = Path.join(CommandsRoot, Folder.name);
            const Files = await Fs.readdir(FolderPath, { withFileTypes: true });
            for (const File of Files) {
                if (File.isFile() && File.name.endsWith('.ts.disabled')) {
                    console.log(`[COMMANDS] Comando desabilitado: ${Folder.name}/${File.name}`);
                }
            }

            for (const File of Files) {
                if (!File.isFile() || !File.name.endsWith('.ts')) {
                    continue;
                }

                try {
                    const ModulePath = Path.join(FolderPath, File.name);
                    const Imported = await import(pathToFileURL(ModulePath).href);
                    const Command: CommandModule = (Imported.default ?? Imported) as CommandModule;

                    if (!Command?.data || typeof Command.run !== 'function') {
                        console.warn(`[COMMANDS] Comando "${File.name}" esta incompleto.`);
                        HasCommandLoadFailure = true;
                        continue;
                    }

                    const JsonCommand = Command.data.toJSON();
                    if (Command.data.guildOnly) {
                        LocalSlashCommands.set(Command.data.name, Command);
                        LoadedLocalCommands.push(JsonCommand);
                        continue;
                    }

                    GlobalSlashCommands.set(Command.data.name, Command);
                    LoadedGlobalCommands.push(JsonCommand);
                } catch (Error) {
                    HasCommandLoadFailure = true;
                    console.error(`[COMMANDS] Falha ao carregar "${Folder.name}/${File.name}":`, Error);
                }
            }
        }

        Client.slashCommands = { local: LocalSlashCommands, global: GlobalSlashCommands };

        Client.once('clientReady', async () => {
            if (HasCommandLoadFailure) {
                console.error(
                    '[COMMANDS] Sincronizacao ignorada porque um ou mais comandos falharam ao carregar. Os comandos ja publicados foram preservados.',
                );
                return;
            }

            const GuildId = process.env.DISCORD_GUILD_ID;

            if (GuildId) {
                const Guild = Client.guilds.cache.get(GuildId);
                if (Guild) {
                    await SyncCommands(
                        Rest,
                        Routes.applicationGuildCommands(ClientId, GuildId),
                        LoadedLocalCommands,
                        'guild',
                    );
                } else {
                    console.warn('[COMMANDS] Guild ID para comandos locais nao encontrada no cache.');
                }
            } else {
                console.warn('[COMMANDS] DISCORD_GUILD_ID nao definido. Ignorando comandos locais.');
            }

            const UniqueGlobalCommands = Array.from(
                new Map(LoadedGlobalCommands.map((Command) => [Command.name, Command])).values(),
            );

            await SyncCommands(
                Rest,
                Routes.applicationCommands(ClientId),
                UniqueGlobalCommands,
                'global',
            );
        });
    } catch (Error) {
        console.error('[COMMANDS] Erro ao carregar comandos:', Error);
    }
}

async function SyncCommands(
    Rest: REST,
    Route: `/${string}`,
    Commands: CommandData[],
    Scope: 'guild' | 'global',
): Promise<void> {
    try {
        console.log(`[COMMANDS] Sincronizando comandos ${Scope}...`);

        const ExistingCommands = (await Rest.get(Route)) as Array<Record<string, any>>;
        const ToRegister: CommandData[] = [];
        const ToUpdate: CommandData[] = [];
        const ToDelete = [...ExistingCommands];

        for (const Command of Commands) {
            const Existing = ExistingCommands.find((Registered) => Registered.name === Command.name);
            if (!Existing) {
                ToRegister.push(Command);
                continue;
            }

            const IsDifferent = !AreCommandsEqual(Existing, Command);
            if (IsDifferent) {
                ToUpdate.push({ id: Existing.id, ...Command });
            }

            const Index = ToDelete.indexOf(Existing);
            if (Index !== -1) {
                ToDelete.splice(Index, 1);
            }
        }

        for (const Command of ToRegister) {
            await Rest.post(Route, { body: Command });
            console.log(`[COMMANDS] Novo comando registrado: ${Command.name}`);
        }

        for (const Command of ToUpdate) {
            await Rest.patch(`${Route}/${Command.id}` as `/${string}`, { body: Command });
            console.log(`[COMMANDS] Comando atualizado: ${Command.name}`);
        }

        for (const Command of ToDelete) {
            await Rest.delete(`${Route}/${Command.id}` as `/${string}`);
            console.log(`[COMMANDS] Comando removido: ${Command.name}`);
        }

        console.log(`[COMMANDS] Sincronizacao ${Scope} concluida.`);
    } catch (Error) {
        console.error(`[COMMANDS] Erro ao sincronizar comandos ${Scope}:`, Error);
    }
}

function AreCommandsEqual(Current: CommandData, Next: CommandData): boolean {
    return JSON.stringify(NormalizeCommandData(Current)) === JSON.stringify(NormalizeCommandData(Next));
}

function NormalizeCommandData(Command: CommandData): CommandData {
    return {
        name: Command.name,
        description: Command.description,
        options: NormalizeOptions(Command.options ?? []),
    };
}

function NormalizeOptions(Options: CommandData[]): CommandData[] {
    return Options
        .map((Option) => {
            const Normalized: CommandData = {
                type: Option.type,
                name: Option.name,
                description: Option.description,
                required: Boolean(Option.required),
            };

            if (Option.choices) {
                Normalized.choices = [...Option.choices].sort((A, B) =>
                    A.name.localeCompare(B.name),
                );
            }

            if (Option.options?.length > 0) {
                Normalized.options = NormalizeOptions(Option.options);
            }

            return Normalized;
        })
        .sort((A, B) => A.name.localeCompare(B.name));
}
