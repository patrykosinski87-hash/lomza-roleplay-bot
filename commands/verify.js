const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Tymczasowe kody weryfikacyjne
const pendingVerifications = new Map();

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'LR-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function loadVerified() {
    const filePath = path.join(__dirname, '../data/verified.json');
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveVerified(data) {
    const filePath = path.join(__dirname, '../data/verified.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Zweryfikuj swoje konto Roblox z Discordem')
        .addStringOption(option =>
            option.setName('nazwa')
                .setDescription('Twoja nazwa użytkownika na Robloxie')
                .setRequired(true)
        ),

    async execute(interaction, client, config, noblox) {
        const robloxName = interaction.options.getString('nazwa');
        const discordId = interaction.user.id;

        // Sprawdź czy już zweryfikowany
        const verified = loadVerified();
        if (verified[discordId]) {
            const alreadyEmbed = new EmbedBuilder()
                .setColor(config.colors.warning)
                .setTitle('⚠️ Już jesteś zweryfikowany!')
                .setDescription(`Twoje konto Discord jest już połączone z kontem Roblox: **${verified[discordId].robloxName}**`)
                .addFields(
                    { name: '📋 Chcesz zmienić konto?', value: 'Skontaktuj się z administratorem.' }
                )
                .setFooter({ text: 'Łomża Roleplay Bot' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [alreadyEmbed], ephemeral: true });
        }

        // Sprawdź czy użytkownik istnieje na Robloxie
        let robloxId;
        try {
            robloxId = await noblox.getIdFromUsername(robloxName);
        } catch (error) {
            const notFoundEmbed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle('❌ Nie znaleziono użytkownika!')
                .setDescription(`Nie znaleziono użytkownika **${robloxName}** na Robloxie.`)
                .addFields(
                    { name: '💡 Upewnij się że:', value: '• Nazwa użytkownika jest poprawna\n• Nie ma literówek\n• Konto istnieje na Robloxie' }
                )
                .setFooter({ text: 'Łomża Roleplay Bot' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
        }

        // Generuj kod weryfikacyjny
        const code = generateCode();
        pendingVerifications.set(discordId, {
            code,
            robloxId,
            robloxName,
            timestamp: Date.now()
        });

        // Usuń kod po 10 minutach
        setTimeout(() => {
            pendingVerifications.delete(discordId);
        }, 10 * 60 * 1000);

        const verifyEmbed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('🔐 Weryfikacja konta Roblox')
            .setDescription(`Cześć **${interaction.user.username}**! Aby zweryfikować swoje konto Roblox, wykonaj poniższe kroki:`)
            .addFields(
                { name: '📝 Krok 1', value: `Wejdź na swój profil Roblox:\n[Kliknij tutaj](https://www.roblox.com/users/${robloxId}/profile)` },
                { name: '✏️ Krok 2', value: `W sekcji **"O mnie"** wpisz poniższy kod:` },
                { name: '🔑 Twój kod weryfikacyjny:', value: `\`\`\`${code}\`\`\`` },
                { name: '✅ Krok 3', value: 'Kliknij przycisk **"Sprawdź weryfikację"** poniżej.' },
                { name: '⏰ Ważne!', value: 'Kod wygaśnie za **10 minut**.' }
            )
            .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`)
            .setFooter({ text: 'Łomża Roleplay Bot' })
            .setTimestamp();

        const checkButton = new ButtonBuilder()
            .setCustomId(`verify_check_${discordId}`)
            .setLabel('✅ Sprawdź weryfikację')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`verify_cancel_${discordId}`)
            .setLabel('❌ Anuluj')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(checkButton, cancelButton);

        await interaction.reply({ embeds: [verifyEmbed], components: [row], ephemeral: true });

        // Obsługa przycisków
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === discordId && 
                        (i.customId === `verify_check_${discordId}` || i.customId === `verify_cancel_${discordId}`),
            time: 10 * 60 * 1000
        });

        collector.on('collect', async i => {
            if (i.customId === `verify_cancel_${discordId}`) {
                pendingVerifications.delete(discordId);
                collector.stop();
                
                const cancelEmbed = new EmbedBuilder()
                    .setColor(config.colors.error)
                    .setTitle('❌ Weryfikacja anulowana')
                    .setDescription('Weryfikacja została anulowana. Możesz spróbować ponownie kiedy chcesz.')
                    .setFooter({ text: 'Łomża Roleplay Bot' })
                    .setTimestamp();
                
                return i.update({ embeds: [cancelEmbed], components: [] });
            }

            if (i.customId === `verify_check_${discordId}`) {
                await i.deferUpdate();
                
                const pending = pendingVerifications.get(discordId);
                if (!pending) {
                    const expiredEmbed = new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setTitle('❌ Kod wygasł!')
                        .setDescription('Twój kod weryfikacyjny wygasł. Użyj komendy `/verify` ponownie.')
                        .setFooter({ text: 'Łomża Roleplay Bot' })
                        .setTimestamp();
                    
                    return i.editReply({ embeds: [expiredEmbed], components: [] });
                }

                // Sprawdź opis profilu
                try {
                    const playerInfo = await noblox.getPlayerInfo(pending.robloxId);
                    const blurb = playerInfo.blurb || '';

                    if (blurb.includes(pending.code)) {
                        // Weryfikacja udana!
                        const verifiedData = loadVerified();
                        verifiedData[discordId] = {
                            robloxId: pending.robloxId,
                            robloxName: pending.robloxName,
                            verifiedAt: new Date().toISOString()
                        };
                        saveVerified(verifiedData);
                        pendingVerifications.delete(discordId);
                        collector.stop();

                        // Nadaj rolę zweryfikowanego
                        try {
                            const member = await interaction.guild.members.fetch(discordId);
                            await member.roles.add(config.verifiedRoleId);
                            await member.setNickname(pending.robloxName).catch(() => {});
                        } catch (roleError) {
                            console.error('Błąd nadawania roli:', roleError);
                        }

                        const successEmbed = new EmbedBuilder()
                            .setColor(config.colors.success)
                            .setTitle('✅ Weryfikacja zakończona sukcesem!')
                            .setDescription(`Twoje konto Discord zostało połączone z kontem Roblox!`)
                            .addFields(
                                { name: '👤 Konto Roblox', value: `**${pending.robloxName}**`, inline: true },
                                { name: '🆔 ID Roblox', value: `\`${pending.robloxId}\``, inline: true },
                                { name: '🎭 Rola', value: 'Otrzymałeś rolę zweryfikowanego!', inline: false }
                            )
                            .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${pending.robloxId}&width=420&height=420&format=png`)
                            .setFooter({ text: 'Łomża Roleplay Bot' })
                            .setTimestamp();

                        await i.editReply({ embeds: [successEmbed], components: [] });

                        // Log weryfikacji
                        const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor(config.colors.success)
                                .setTitle('🔐 Nowa weryfikacja')
                                .addFields(
                                    { name: '👤 Discord', value: `<@${discordId}> (${interaction.user.tag})`, inline: true },
                                    { name: '🎮 Roblox', value: `**${pending.robloxName}** (\`${pending.robloxId}\`)`, inline: true }
                                )
                                .setFooter({ text: 'Łomża Roleplay Bot' })
                                .setTimestamp();
                            
                            logChannel.send({ embeds: [logEmbed] });
                        }
                    } else {
                        const failEmbed = new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setTitle('❌ Nie znaleziono kodu!')
                            .setDescription('Nie znaleziono kodu weryfikacyjnego w opisie Twojego profilu.')
                            .addFields(
                                { name: '💡 Upewnij się że:', value: `• Wkleiłeś kod \`${pending.code}\` w opis profilu\n• Zapisałeś zmiany na Robloxie\n• Odczekałeś chwilę po zapisaniu` }
                            )
                            .setFooter({ text: 'Łomża Roleplay Bot' })
                            .setTimestamp();
                        
                        await i.editReply({ embeds: [failEmbed], components: [row] });
                    }
                } catch (error) {
                    console.error('Błąd sprawdzania weryfikacji:', error);
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                pendingVerifications.delete(discordId);
            }
        });
    }
};