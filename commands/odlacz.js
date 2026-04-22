const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('odlacz')
        .setDescription('Odlacz konto Roblox od Discorda')
        .addUserOption(o =>
            o.setName('gracz')
                .setDescription('Gracz (zostaw puste aby odlaczyc swoje)')
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('powod')
                .setDescription('Powod odlaczenia')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, config, db) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetUser = interaction.options.getUser('gracz') || interaction.user;
        const powod = interaction.options.getString('powod') || 'Brak powodu';
        const targetId = targetUser.id;
        const isSelf = targetId === interaction.user.id;

        try {
            const existing = await db.get(`v_${targetId}`);

            if (!existing) {
                return interaction.editReply({
                    content: isSelf
                        ? '⚠️ Nie masz podlaczonego konta!'
                        : `⚠️ Gracz <@${targetId}> nie ma podlaczonego konta!`
                });
            }

            const stareId = existing.robloxId;
            await db.delete(`v_${targetId}`);

            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (member) {
                if (config.verifiedRoleId) await member.roles.remove(config.verifiedRoleId).catch(() => {});
                if (config.unverifiedRoleId) await member.roles.add(config.unverifiedRoleId).catch(() => {});
                await member.setNickname(null).catch(() => {});
            }

            const embed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('✅ Konto odlaczone!')
                .addFields(
                    { name: '👤 Gracz', value: `<@${targetId}>`, inline: true },
                    { name: '🆔 Bylo ID', value: `\`${stareId}\``, inline: true },
                    { name: '📝 Powod', value: powod, inline: false },
                    { name: '👮 Przez', value: isSelf ? 'Samoodlaczenie' : `<@${interaction.user.id}>`, inline: false }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            if (!isSelf) {
                await targetUser.send({
                    embeds: [new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setTitle('⚠️ Konto odlaczone!')
                        .setDescription(`Admin odlaczyl Twoje konto Roblox.\n**Powod:** ${powod}\n\nMozesz ponownie uzyc \`/weryfikacja\`.`)
                        .setFooter({ text: 'Lomza Roleplay' })
                        .setTimestamp()
                    ]
                }).catch(() => {});
            }

            if (config.logChannelId) {
                const log = interaction.guild.channels.cache.get(config.logChannelId);
                if (log) {
                    await log.send({
                        embeds: [new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setTitle('🔓 Konto odlaczone')
                            .addFields(
                                { name: '👤 Gracz', value: `<@${targetId}>`, inline: true },
                                { name: '🆔 Bylo ID', value: `\`${stareId}\``, inline: true },
                                { name: '👮 Przez', value: isSelf ? 'Sam' : `<@${interaction.user.id}>`, inline: true },
                                { name: '📝 Powod', value: powod, inline: false }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            }

        } catch (e) {
            console.error('Blad odlaczania:', e.message);
            await interaction.editReply({ content: `❌ Blad: ${e.message}` });
        }
    }
};
