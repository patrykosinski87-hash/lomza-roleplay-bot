const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weryfikacja')
        .setDescription('Szybka weryfikacja dla Lomza Roleplay')
        .addStringOption(o => o.setName('nick').setDescription('Twoj nick na Robloxie').setRequired(true)),

    async execute(interaction, client, config) {
        // Bot od razu zaczyna myśleć
        await interaction.deferReply({ ephemeral: true });
        
        const robloxName = interaction.options.getString('nick');
        const discordId = interaction.user.id;

        try {
            const member = await interaction.guild.members.fetch(discordId);
            
            // 1. NADAWANIE ROLI OBYWATEL
            if (config.verifiedRoleId) {
                await member.roles.add(config.verifiedRoleId).catch(e => console.log("Błąd roli: " + e.message));
            }

            // 2. ZABIERANIE ROLI NIEZWERYFIKOWANY
            if (config.unverifiedRoleId) {
                await member.roles.remove(config.unverifiedRoleId).catch(e => console.log("Błąd roli: " + e.message));
            }
            
            // 3. ZMIANA NICKU NA: NickDiscord (@NickRoblox)
            const nowyNick = `${interaction.user.username} (@${robloxName})`;
            await member.setNickname(nowyNick).catch(e => console.log("Błąd nicku: " + e.message));

            const successEmbed = new EmbedBuilder()
                .setColor("#00FF7F")
                .setTitle('✅ Pomyslnie zweryfikowano!')
                .setDescription(`Witaj **${interaction.user.username}**!\nTwoje konto zostalo polaczone z nickiem Roblox: **${robloxName}**.\n\nOtrzymales range Obywatel i Twoj nick zostal zaktualizowany.`)
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Wystąpił błąd podczas nadawania rangi. Upewnij się, że rola bota jest wyżej niż role graczy!' });
        }
    }
};
