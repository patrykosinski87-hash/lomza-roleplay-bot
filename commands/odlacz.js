const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('odlacz')
        .setDescription('Odlacz konto Roblox od Discorda')
        .addUserOption(option =>
            option.setName('gracz')
                .setDescription('Gracz ktoremu odlaczasz konto')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('powod')
                .setDescription('Powod odlaczenia')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, config, noblox, db) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Sprawdz czy db istnieje
            if (!db) {
                console.error('❌ BLAD: db jest undefined!');
                return interaction.editReply({ content: '❌ Blad bazy danych - db jest undefined!' });
            }

            const targetUser = interaction.options.getUser('gracz') || interaction.user;
            const powod = interaction.options.getString('powod') || 'Brak powodu';
            const targetId = targetUser.id;
            const isSelf = targetId === interaction.user.id;

            console.log(`🔍 Szukam konta dla: ${targetId}`);

            // Pobierz dane
            let existing;
            try {
                existing = await db.get(`verified_${targetId}`);
                console.log(`📦 Dane z bazy:`, existing);
            } catch (dbError) {
                console.error('❌ Blad odczytu bazy:', dbError.message);
                return interaction.editReply({ content: `❌ Blad odczytu bazy: ${dbError.message}` });
            }

            if (!existing) {
                return interaction.editReply({
                    content: isSelf
                        ? '⚠️ Nie masz podlaczonego konta Roblox.'
                        : `⚠️ Gracz <@${targetId}> nie ma podlaczonego konta.`
                });
            }

            const stareId = existing.robloxId;
            console.log(`🗑️ Usuwam konto: ${stareId}`);

            // Usun z bazy
            try {
                await db.delete(`verified_${targetId}`);
                console.log(`✅ Usunieto konto z bazy`);
            } catch (dbError) {
                console.error('❌ Blad usuwania z bazy:', dbError.message);
                return interaction.editReply({ content: `❌ Blad usuwania z bazy: ${dbError.message}` });
            }

            // Pobierz membera
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            console.log(`👤 Member znaleziony: ${member ? 'TAK' : 'NIE'}`);

            if (member) {
                if (config.verifiedRoleId) {
                    await member.roles.remove(config.verifiedRoleId).catch(e => console.log('Blad roli:', e.message));
                }
                if (config.unverifiedRoleId) {
                    await member.roles.add(config.unverifiedRoleId).catch(e => console.log('Blad roli:', e.message));
                }
                await member.setNickname(null).catch(e => console.log('Blad nicku:', e.message));
            }

            const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('✅ Konto zostalo odlaczone!')
                .addFields(
                    { name: '👤 Gracz', value: `<@${targetId}>`, inline: true },
                    { name: '🆔 Bylo ID', value: `\`${stareId}\``, inline: true },
                    { name: '📝 Powod', value: powod, inline: false },
                    {
                        name: '👮 Odlaczyl',
                        value: isSelf ? 'Sam odlaczyl konto' : `<@${interaction.user.id}>`,
                        inline: false
                    }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // DM
            if (!isSelf) {
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.colors.error)
                    .setTitle('⚠️ Twoje konto zostalo odlaczone!')
                    .setDescription('Administrator odlaczyl Twoje konto Roblox.')
                    .addFields(
                        { name: '📝 Powod', value: powod },
                        { name: '🔄 Co teraz?', value: 'Mozesz ponownie uzyc `/weryfikacja`.' }
                    )
                    .setFooter({ text: 'Lomza Roleplay' })
                    .setTimestamp();
                await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
            }

            // Log
            if (config.logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setTitle('🔓 Konto odlaczone | Log')
                        .addFields(
                            { name: '👤 Gracz', value: `<@${targetId}>`, inline: true },
                            { name: '🆔 Bylo ID', value: `\`${stareId}\``, inline: true },
                            { name: '👮 Odlaczyl', value: isSelf ? 'Samoodlaczenie' : `<@${interaction.user.id}>`, inline: true },
                            { name: '📝 Powod', value: powod, inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

        } catch (error) {
            console.error('❌ GLOWNY BLAD odlaczania:', error.message);
            console.error('Stack:', error.stack);
            await interaction.editReply({
                content: `❌ Blad: ${error.message}`
            });
        }
    }
};
