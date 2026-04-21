const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('fs');
require('dotenv').config();

const config = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    groupId: parseInt(process.env.GROUP_ID) || 0,
    roblosecurity: process.env.ROBLOSECURITY,
    logChannelId: process.env.LOG_CHANNEL_ID,
    verifiedRoleId: process.env.VERIFIED_ROLE_ID,
    unverifiedRoleId: process.env.UNVERIFIED_ROLE_ID,
    adminRoleId: process.env.ADMIN_ROLE_ID,
    colors: { success: "#00FF7F", error: "#FF4444", info: "#5865F2", warning: "#FFA500" }
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.commands = new Collection();
const commands = [];

// BEZPIECZNE ŁADOWANIE KOMEND
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    try {
        const command = require(`./commands/${file}`);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
            console.log(`✅ Załadowano komendę: ${file}`);
        }
    } catch (error) {
        console.error(`❌ BŁĄD w pliku ${file}:`, error.message);
    }
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('⏳ Odświeżam komendy slash...');
        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
        console.log('✅ Komendy zarejestrowane pomyślnie!');
    } catch (error) {
        console.error('❌ Błąd rejestracji komend:', error.message);
    }
})();

client.once('ready', async () => {
    console.log(`🚀 Bot ${client.user.tag} gotowy!`);
    try {
        await noblox.setCookie(config.roblosecurity);
        console.log(`✅ Połączono z Roblox!`);
    } catch (e) { console.log("⚠️ Błąd Roblox Cookie (Weryfikacja może nie działać)"); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client, config, noblox);
    } catch (error) {
        console.error("Błąd podczas komendy:", error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ Wystąpił błąd wewnętrzny bota.', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Wystąpił błąd podczas uruchamiania komendy.', ephemeral: true });
        }
    }
});

client.login(config.token);
