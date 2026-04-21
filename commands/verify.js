const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const pendingVerifications = new Map();

function generateCode() {
    const kolory = ['czerwony', 'niebieski', 'zielony', 'pomaranczowy', 'fioletowy', 'bialy', 'czarny', 'zloty', 'srebrny', 'rozowy'];
    const zwierzeta = ['lew', 'orzel', 'wilk', 'tygrys', 'sokol', 'pantera', 'jelen', 'krolik', 'lis', 'niedzwiedz'];
    const liczba = Math.floor(Math.random() * 999) + 1;
    const kolor = kolory[Math.floor(Math.random() * kolory.length)];
    const zwierze = zwierzeta[Math.floor(Math.random() * zwierzeta.length)];
    return `${kolor}-${zwierze}-${liczba}`;
}

function loadVerified() {
    const file = path.join(__dirname, '../data/verified.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, '{}');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveVerified(data) {
    fs.writeFileSync(path.join(__dirname, '../data/verified.json'), JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weryfikacja')
        .setDescription('Zweryfikuj swoje konto Roblox z Discordem')
        .addStringOption(o =>
            o.setName('nick')
                .setDescription('Twoj nick na Robloxie')
                .setRequired(true)
        ),

    async execute(interaction, client, config, noblox) {
        try {
            const robloxName = interaction.options.getString('nick');
            const discordId = interaction.user.id;

            // Sprawdz czy juz zweryfikowany
            const verified = loadVerified();
            if (verified[discordId]) {
                const alreadyEmbed = new EmbedBuilder()
                    .setColor(config.colors.warning)
                    .setTitle('⚠️ Jestes juz zweryfikowany!')
                    .setDescription(`Twoje konto jest juz polaczone z: **${verified[discordId].robloxName}**`)
                    .addFields({ name: '❓ Chcesz zmienic konto?', value: 'Skontaktuj sie z administratorem.' })
                    .setFooter({ text: 'Lomza Roleplay' })
                    .setTimestamp();
                return interaction.reply({ embeds: [alreadyEmbed], ephemeral: true });
            }

            // Sprawdz czy nick istnieje na Robloxie
            let robloxId;
            try {
                robloxId = await noblox.getIdFromUsername(robloxName);
            } catch {
                const notFoundEmbed = new EmbedBuilder()
                    .setColor(config.colors.error)
                    .setTitle('❌ Nie znaleziono gracza!')
                    .setDescription(`Nie znaleziono gracza **${robloxName}** na Robloxie.`)
                    .addFields({ name: '💡 Sprawdz czy:', value: '• Nick jest poprawny\n• Nie ma literowek\n• Konto istnieje na Robloxie' })
                    .setFooter({ text: 'Lomza Roleplay' })
                    .setTimestamp();
                return interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
            }

            // Generuj haslo
            const haslo = generateCode();
            pendingVerifications.set(discordId, {
                haslo,
                robloxId,
                robloxName,
                timestamp: Date.now()
            });

            // Usun haslo po 10 minutach
            setTimeout(() => {
                pendingVerifications.delete(discordId);
            }, 10 * 60 * 1000);

            const verifyEmbed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle('🔐 Weryfikacja | Lomza Roleplay')
                .setDescription(`Czesc **${interaction.user.username}**!\n\nAby zweryfikowac swoje konto Roblox wykonaj ponizsze kroki:`)
                .addFields(
                    { name: '📝 Krok 1', value: `[➡️ Wejdz na swoj profil Roblox](https://www.roblox.com/users/${robloxId}/profile)` },
                    { name: '✏️ Krok 2', value: 'Wklej ponizsze haslo w sekcji **"O mnie"** na swoim profilu:' },
                    { name: '🔑 Twoje haslo:', value: `\`\`\`${haslo}\`\`\`` },
                    { name: '💾 Krok 3', value: 'Zapisz zmiany na profilu Roblox!' },
                    { name: '✅ Krok 4', value: 'Kliknij przycisk **"🔍 Weryfikuj"** ponizej.' },
                    { name: '⏰ Uwaga!', value: 'Haslo wygasnie za **10 minut**.' }
                )
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`)
                .setFooter({ text: 'Lomza Roleplay | System Weryfikacji' })
                .setTimestamp();

            const verifyButton = new ButtonBuilder()
                .setCustomId(`weryfikuj_${discordId}`)
                .setLabel('🔍 Weryfikuj')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId(`anuluj_${discordId}`)
                .setLabel('❌ Anuluj')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(verifyButton, cancelButton);

            await interaction.reply({ embeds: [verifyEmbed], components: [row], ephemeral: true });

            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === discordId &&
                    (i.customId === `weryfikuj_${discordId}` || i.customId === `anuluj_${discordId}`),
                time: 10 * 60 * 1000
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId === `anuluj_${discordId}`) {
                        pendingVerifications.delete(discordId);
                        collector.stop();

                        const cancelEmbed = new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setTitle('❌ Weryfikacja anulowana')
                            .setDescription('Anulowales weryfikacje. Mozesz sprobowac ponownie kiedy chcesz.')
                            .setFooter({ text: 'Lomza Roleplay' })
                            .setTimestamp();

                        return i.update({ embeds: [cancelEmbed], components: [] });
                    }

                    if (i.customId === `weryfikuj_${discordId}`) {
                        await i.deferUpdate();

                        const pending = pendingVerifications.get(discordId);
                        if (!pending) {
                            const expiredEmbed = new EmbedBuilder()
                                .setColor(config.colors.error)
                                .setTitle('⏰ Haslo wygaslo!')
                                .setDescription('Twoje haslo weryfikacyjne wygaslo.\nUzyj komendy `/weryfikacja` ponownie.')
                                .setFooter({ text: 'Lomza Roleplay' })
                                .setTimestamp();
                            return i.editReply({ embeds: [expiredEmbed], components: [] });
                        }

                        // Sprawdz opis profilu
                        let playerInfo;
                        try {
                            playerInfo = await noblox.getPlayerInfo(pending.robloxId);
                        } catch (robloxError) {
                            console.error('Blad pobierania profilu Roblox:', robloxError);
                            const robloxErrorEmbed = new EmbedBuilder()
                                .setColor(config.colors.error)
                                .setTitle('❌ Blad pobierania profilu!')
                                .setDescription('Nie udalo sie pobrac Twojego profilu Roblox.\nSprobuj ponownie za chwile.')
                                .setFooter({ text: 'Lomza Roleplay' })
                                .setTimestamp();
                            return i.editReply({ embeds: [robloxErrorEmbed], components: [row] });
                        }

                        const opis = playerInfo.blurb || '';

                        if (opis.includes(pending.haslo)) {
                            // Weryfikacja udana
                            const verifiedData = loadVerified();
                            verifiedData[discordId] = {
                                robloxId: pending.robloxId,
                                robloxName: pending.robloxName,
                                verifiedAt: new Date().toISOString()
                            };
                            saveVerified(verifiedData);
                            pendingVerifications.delete(discordId);
                            collector.stop();

                            // Nadaj role i zmien nick
                            try {
                                const member = await interaction.guild.members.fetch(discordId);

                                // Nadaj role Obywatel
                                if (config.verifiedRoleId) {
                                    await member.roles.add(config.verifiedRoleId);
                                    console.log(`✅ Nadano role Obywatel dla ${member.user.tag}`);
                                }

                                // Zabierz role Niezweryfikowany
                                if (config.unverifiedRoleId) {
                                    await member.roles.remove(config.unverifiedRoleId);
                                    console.log(`✅ Usunieto role Niezweryfikowany dla ${member.user.tag}`);
                                }

                                // Zmien nick
                                const nowyNick = `${member.displayName} (@${pending.robloxName})`;
                                await member.setNickname(nowyNick);
                                console.log(`✅ Zmieniono nick dla ${member.user.tag} na ${nowyNick}`);

                            } catch (roleError) {
                                console.error('Blad nadawania roli/nicku:', roleError.message);
                            }

                            const successEmbed = new EmbedBuilder()
                                .setColor(config.colors.success)
                                .setTitle('✅ Weryfikacja zakonczona pomyslnie!')
                                .setDescription('Twoje konto Discord zostalo polaczone z kontem Roblox!')
                                .addFields(
                                    { name: '🎮 Konto Roblox', value: `**${pending.robloxName}**`, inline: true },
                                    { name: '🆔 ID Roblox', value: `\`${pending.robloxId}\``, inline: true },
                                    { name: '🏷️ Nowy nick', value: `(@${pending.robloxName})`, inline: false },
                                    { name: '✅ Rola', value: 'Otrzymales role **Obywatel**!', inline: false }
                                )
                                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${pending.robloxId}&width=420&height=420&format=png`)
                                .setFooter({ text: 'Lomza Roleplay | Zweryfikowano' })
                                .setTimestamp();

                            await i.editReply({ embeds: [successEmbed], components: [] });

                            // Wyslij log
                            try {
                                const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
                                if (logChannel) {
                                    const logEmbed = new EmbedBuilder()
                                        .setColor(config.colors.success)
                                        .setTitle('🔐 Nowa weryfikacja')
                                        .addFields(
                                            { name: '👤 Discord', value: `<@${discordId}> (${interaction.user.tag})`, inline: true },
                                            { name: '🎮 Roblox', value: `**${pending.robloxName}** (\`${pending.robloxId}\`)`, inline: true }
                                        )
                                        .setFooter({ text: 'Lomza Roleplay | Log weryfikacji' })
                                        .setTimestamp();
                                    await logChannel.send({ embeds: [logEmbed] });
                                }
                            } catch (logError) {
                                console.error('Blad wysylania logu:', logError.message);
                            }

                        } else {
                            const failEmbed = new EmbedBuilder()
                                .setColor(config.colors.error)
                                .setTitle('❌ Nie znaleziono hasla w opisie!')
                                .setDescription('Nie znaleziono hasla weryfikacyjnego w opisie profilu Roblox.')
                                .addFields(
                                    { name: '💡 Upewnij sie ze:', value: `• Wpisales haslo \`${pending.haslo}\` w opis profilu\n• Zapisales zmiany na Robloxie\n• Odczekales chwile po zapisaniu` },
                                    { name: '🔄 Sprobuj ponownie', value: 'Kliknij **"🔍 Weryfikuj"** ponownie po poprawieniu opisu.' }
                                )
                                .setFooter({ text: 'Lomza Roleplay' })
                                .setTimestamp();

                            await i.editReply({ embeds: [failEmbed], components: [row] });
                        }
                    }
                } catch (collectError) {
                    console.error('Blad w collectorze:', collectError);
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    pendingVerifications.delete(discordId);
                }
            });

        } catch (mainError) {
            console.error('Glowny blad weryfikacji:', mainError);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ Wystapil blad podczas weryfikacji. Sprobuj ponownie.', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Wystapil blad podczas weryfikacji. Sprobuj ponownie.', ephemeral: true });
                }
            } catch (e) {
                console.error('Blad odpowiedzi:', e);
            }
        }
    }
};
