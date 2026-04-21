const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weryfikacja')
        .setDescription('Zweryfikuj swoje konto Roblox')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Twoje ID z Roblox (tylko cyfry)')
                .setRequired(true)
        ),

    async execute(interaction, client, config, noblox, db) {
        await interaction.deferReply({ ephemeral: true });

        const robloxId = interaction.options.getString('id');
        const discordId = interaction.user.id;

        if (!/^\d+$/.test(robloxId)) {
            return interaction.editReply({ content: '❌ Podaj poprawne ID Roblox (tylko cyfry)!' });
        }

        try {
            const member = await interaction.guild.members.fetch(discordId);
            const isAdmin = member.permissions.has('Administrator');

            // Sprawdz czy juz zweryfikowany
            const existing = await db.get(`verified.${discordId}`);
            if (existing) {
                if (isAdmin) {
                    await db.delete(`verified.${discordId}`);
                } else {
                    return interaction.editReply({
                        content: `⚠️ Jestes juz zweryfikowany pod ID: \`${existing.robloxId}\`.\nSkontaktuj sie z administratorem jeśli chcesz zmienić konto.`
                    });
                }
            }

            // Zapisz weryfikację
            await db.set(`verified.${discordId}`, {
                robloxId: robloxId,
                verifiedAt: Date.now()
            });

            // Nadaj role
            if (config.verifiedRoleId) await member.roles.add(config.verifiedRoleId).catch(() => {});
            if (config.unverifiedRoleId) await member.roles.remove(config.unverifiedRoleId).catch(() => {});

            // Zmien nick
            const nowyNick = `${interaction.user.username} (@${robloxId})`;
            await member.setNickname(nowyNick).catch(() => {});

            const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('✅ Weryfikacja zakończona pomyślnie!')
                .setDescription(`Twoje konto zostało zweryfikowane!\n**ID Roblox:** \`${robloxId}\``)
                .addFields(
                    { name: '🏷️ Nowy nick', value: `\`${nowyNick}\``, inline: false },
                    { name: '🎖️ Ranga', value: 'Otrzymałeś rangę **Obywatel**', inline: false }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // Log
            if (config.logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setTitle('🔐 Nowa weryfikacja')
                        .addFields(
                            { name: '👤 Discord', value: `<@${discordId}> (${interaction.user.tag})`, inline: true },
                            { name: '🆔 ID Roblox', value: `\`${robloxId}\``, inline: true },
                            { name: '🏷️ Nick', value: `\`${nowyNick}\``, inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Wystąpił błąd podczas weryfikacji.' });
        }
    }
};
