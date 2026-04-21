const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('fs');
require('dotenv').config();
const db = require('./database');

const config = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    roblosecurity: process.env.ROBLOSECURITY,
    logChannelId: process.env.LOG_CHANNEL_ID,
    verifiedRoleId: process.env.VERIFIED_ROLE_ID,
    unverifiedRoleId: process.env.UNVERIFIED_ROLE_ID,
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

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    try {
        const command = require(`./commands/${file}`);
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`✅ Załadowano: ${file}`);
    } catch (error) {
        console.error(`❌ Błąd w pliku ${file}:`, error.message);
    }
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('⏳ Rejestruje komendy...');
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );
        console.log('✅ Komendy zarejestrowane!');
    } catch (error) {
        console.error('❌ Błąd rejestracji komend:', error.message);
    }
})();

client.once('ready', async () => {
    console.log(`✅ Bot ${client.user.tag} jest online!`);
    console.log(`🎮 Lomza Roleplay Bot - gotowy do działania`);

    if (config.roblosecurity) {
        try {
            await noblox.setCookie(config.roblosecurity);
            console.log('✅ Połączono z Roblox');
        } catch (e) {
            console.log('⚠️ Nie udało się połączyć z Roblox (cookie może być złe)');
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client, config, noblox, db);
    } catch (error) {
        console.error(error);
        const reply = { content: '❌ Wystąpił błąd!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

client.login(config.token);
