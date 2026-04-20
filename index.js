const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('fs');
require('dotenv').config();   // ← To jest nowa linijka

const config = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    groupId: parseInt(process.env.GROUP_ID),
    roblosecurity: process.env.ROBLOSECURITY,
    logChannelId: process.env.LOG_CHANNEL_ID,
    verificationChannelId: process.env.VERIFICATION_CHANNEL_ID,
    verifiedRoleId: process.env.VERIFIED_ROLE_ID,
    adminRoleId: process.env.ADMIN_ROLE_ID,
    colors: {
        success: "#00FF7F",
        error: "#FF4444",
        info: "#5865F2",
        warning: "#FFA500"
    }
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// Ładowanie komend
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

// Rejestracja komend
const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('⏳ Rejestruję komendy...');
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );
        console.log('✅ Komendy zarejestrowane!');
    } catch (error) {
        console.error('❌ Błąd rejestracji komend:', error);
    }
})();

client.once('ready', async () => {
    console.log(`✅ Bot ${client.user.tag} jest online!`);
    console.log(`🎮 Łomża Roleplay Bot działa 24/7`);

    try {
        await noblox.setCookie(config.roblosecurity);
        const user = await noblox.getCurrentUser();
        console.log(`✅ Zalogowano do Roblox jako: ${user.UserName}`);
    } catch (error) {
        console.error('❌ Błąd logowania do Roblox:', error.message);
    }

    client.user.setActivity('Łomża Roleplay', { type: 3 });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client, config, noblox);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: '❌ Wystąpił błąd!', ephemeral: true }).catch(() => {});
    }
});

client.login(config.token);