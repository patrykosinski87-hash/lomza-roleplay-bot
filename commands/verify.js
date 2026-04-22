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
            const existing = await db.get(`verified_${discordId}`);

            if (existing) {
                if (isAdmin) {
                    await db.delete(`verified_${discordId}`);
                } else {
                    return interaction.editReply({
                        content: `⚠️ Jestes juz zweryfikowany pod ID: \`${existing.robloxId}\`.\nSkontaktuj sie z administratorem jesli chcesz zmienic konto.`
                    });
                }
            }

            await db.set(`verified_${discordId}`, {
                robloxId: robloxId,
                verifiedAt: Date.now()
            });

            if (config.verifiedRoleId) await member.roles.add(config.verifiedRoleId).catch(() => {});
            if (config.unverifiedRoleId) await member.roles.remove(config.unverifiedRoleId).catch(() => {});

            const nowyNick = `${interaction.user.username} (@${robloxId})`;
            await member.setNickname(nowyNick).catch(() => {});

            const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('✅ Weryfikacja zakonczona pomyslnie!')
                .setDescription(`Twoje konto zostalo zweryfikowane!`)
                .addFields(
                    { name: '🆔 ID Roblox', value: `\`${robloxId}\``, inline: true },
                    { name: '🏷️ Nowy nick', value: `\`${nowyNick}\``, inline: true },
                    { name: '🎖️ Ranga', value: 'Otrzymales range **Obywatel**', inline: false }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            if (config.logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setTitle('🔐 Nowa weryfikacja | Log')
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
            console.error('Blad weryfikacji:', error);
            await interaction.editReply({ content: '❌ Wystapil blad podczas weryfikacji.' });
        }
    }
};
