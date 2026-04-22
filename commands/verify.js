const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weryfikacja')
        .setDescription('Zweryfikuj swoje konto Roblox')
        .addStringOption(o =>
            o.setName('id')
                .setDescription('Twoje ID Roblox (tylko cyfry)')
                .setRequired(true)
        ),

    async execute(interaction, config, db) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const robloxId = interaction.options.getString('id');
        const discordId = interaction.user.id;

        if (!/^\d+$/.test(robloxId)) {
            return interaction.editReply({ content: '❌ Podaj poprawne ID Roblox (tylko cyfry)!' });
        }

        try {
            const member = await interaction.guild.members.fetch(discordId);
            const isAdmin = member.permissions.has('Administrator');
            const existing = await db.get(`v_${discordId}`);

            if (existing && !isAdmin) {
                return interaction.editReply({
                    content: `⚠️ Masz juz podlaczone konto ID: \`${existing.robloxId}\`\nSkontaktuj sie z adminem aby zmienic.`
                });
            }

            await db.set(`v_${discordId}`, { robloxId, date: Date.now() });

            if (config.verifiedRoleId) await member.roles.add(config.verifiedRoleId).catch(() => {});
            if (config.unverifiedRoleId) await member.roles.remove(config.unverifiedRoleId).catch(() => {});
            await member.setNickname(`${interaction.user.username} (@${robloxId})`).catch(() => {});

            const embed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('✅ Zweryfikowano!')
                .addFields(
                    { name: '🆔 ID Roblox', value: `\`${robloxId}\``, inline: true },
                    { name: '🏷️ Nick', value: `\`${interaction.user.username} (@${robloxId})\``, inline: true },
                    { name: '🎖️ Ranga', value: '**Obywatel**', inline: false }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            if (config.logChannelId) {
                const log = interaction.guild.channels.cache.get(config.logChannelId);
                if (log) {
                    await log.send({
                        embeds: [new EmbedBuilder()
                            .setColor(config.colors.success)
                            .setTitle('🔐 Nowa weryfikacja')
                            .addFields(
                                { name: '👤 Discord', value: `<@${discordId}>`, inline: true },
                                { name: '🆔 ID Roblox', value: `\`${robloxId}\``, inline: true }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            }

        } catch (e) {
            console.error('Blad weryfikacji:', e.message);
            await interaction.editReply({ content: `❌ Blad: ${e.message}` });
        }
    }
};
