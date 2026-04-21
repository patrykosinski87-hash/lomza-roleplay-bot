const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weryfikacja')
        .setDescription('Weryfikacja po ID Roblox (bez cookie)')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Twoje ID z Roblox (tylko liczby)')
                .setRequired(true)
        ),

    async execute(interaction, client, config) {
        await interaction.deferReply({ ephemeral: true });

        const robloxId = interaction.options.getString('id');
        const discordId = interaction.user.id;

        // Sprawdzenie czy ID wygląda sensownie
        if (!/^\d+$/.test(robloxId)) {
            return interaction.editReply({ content: '❌ Podaj poprawne ID Roblox (tylko cyfry)!' });
        }

        try {
            const member = await interaction.guild.members.fetch(discordId);

            // Nadawanie roli Obywatel
            if (config.verifiedRoleId) {
                await member.roles.add(config.verifiedRoleId).catch(() => {});
            }

            // Zabieranie roli Niezweryfikowany
            if (config.unverifiedRoleId) {
                await member.roles.remove(config.unverifiedRoleId).catch(() => {});
            }

            // Zmiana nicku na: Nick (@ID)
            const nowyNick = `${interaction.user.username} (@${robloxId})`;
            await member.setNickname(nowyNick).catch(() => {});

            const successEmbed = new EmbedBuilder()
                .setColor("#00FF7F")
                .setTitle('✅ Weryfikacja zakończona pomyślnie!')
                .setDescription(`Twoje konto zostało zweryfikowane!\n\n**ID Roblox:** \`${robloxId}\``)
                .addFields(
                    { name: '🏷️ Nowy nick na serwerze', value: `\`${nowyNick}\``, inline: false },
                    { name: '🎖️ Ranga', value: 'Otrzymałeś rangę **Obywatel**', inline: false }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Wystąpił błąd. Sprawdź czy bot ma rolę wyżej niż Twoje role i czy ma uprawnienia do zarządzania rolami i nickami.' });
        }
    }
};
