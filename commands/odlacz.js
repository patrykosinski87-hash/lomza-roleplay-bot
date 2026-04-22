const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('odlacz')
        .setDescription('Odlacz konto Roblox od Discorda')
        .addUserOption(option =>
            option.setName('gracz')
                .setDescription('Gracz ktoremu odlaczasz konto (zostaw puste, aby odlaczyc swoje)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('powod')
                .setDescription('Powod odlaczenia konta')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, config, noblox, db) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('gracz') || interaction.user;
        const powod = interaction.options.getString('powod') || 'Brak powodu';
        const targetId = targetUser.id;
        const isSelf = targetId === interaction.user.id;

        try {
            // Pobierz dane z bazy quick.db
            const existing = await db.get(`verified.${targetId}`);

            if (!existing) {
                const notVerifiedEmbed = new EmbedBuilder()
                    .setColor(config.colors.warning)
                    .setTitle('⚠️ Konto nie jest podlaczone!')
                    .setDescription(
                        isSelf
                            ? 'Nie masz podlaczonego konta Roblox.'
                            : `Gracz <@${targetId}> nie ma podlaczonego konta Roblox.`
                    )
                    .setFooter({ text: 'Lomza Roleplay' })
                    .setTimestamp();
                return interaction.editReply({ embeds: [notVerifiedEmbed] });
            }

            const stareId = existing.robloxId;

            // Usun z bazy danych
            await db.delete(`verified.${targetId}`);

            // Pobierz membera z serwera
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);

            if (member) {
                // Zabierz role Obywatel
                if (config.verifiedRoleId) {
                    await member.roles.remove(config.verifiedRoleId).catch(() => {});
                }

                // Nadaj role Niezweryfikowany
                if (config.unverifiedRoleId) {
                    await member.roles.add(config.unverifiedRoleId).catch(() => {});
                }

                // Przywroc nick
                await member.setNickname(null).catch(() => {});
            }

            // Embed sukcesu
            const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('✅ Konto zostalo odlaczone!')
                .addFields(
                    { name: '👤 Gracz', value: `<@${targetId}>`, inline: true },
                    { name: '🆔 Bylo ID Roblox', value: `\`${stareId}\``, inline: true },
                    { name: '📝 Powod', value: powod, inline: false },
                    {
                        name: '👮 Operacje wykonal',
                        value: isSelf ? 'Gracz sam odlaczyl swoje konto' : `<@${interaction.user.id}>`,
                        inline: false
                    }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // DM do gracza (jesli to nie on sam sie odlacza)
            if (!isSelf) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setTitle('⚠️ Twoje konto zostalo odlaczone!')
                        .setDescription(`Administrator odlaczyl Twoje konto Roblox od serwera **Lomza Roleplay**.`)
                        .addFields({ name: '📝 Powod', value: powod })
                        .setFooter({ text: 'Lomza Roleplay' })
                        .setTimestamp();

                    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
                } catch (e) { /* Gracz ma wylaczone DM */ }
            }

            // Log na kanal logow
            if (config.logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setTitle('🔓 Konto odlaczone | Log')
                        .addFields(
                            { name: '👤 Gracz', value: `<@${targetId}> (${targetUser.tag})`, inline: true },
                            { name: '🆔 Bylo ID', value: `\`${stareId}\``, inline: true },
                            { name: '👮 Administrator', value: isSelf ? 'Samoodlaczenie' : `<@${interaction.user.id}>`, inline: true },
                            { name: '📝 Powod', value: powod, inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

        } catch (error) {
            console.error('Blad odlaczania konta:', error);
            await interaction.editReply({ content: '❌ Wystapil blad podczas odlaczania konta.' });
        }
    }
};
