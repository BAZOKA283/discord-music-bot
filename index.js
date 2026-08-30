const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const ffmpeg = require('ffmpeg-static');
const express = require('express');

process.env.FFMPEG_PATH = ffmpeg;

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('تشغيل أغنية من يوتيوب بالاسم أو الرابط')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('اسم الأغنية أو رابط يوتيوب')
                .setRequired(true)
        )
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'play') {
        const query = interaction.options.getString('song');
        const voiceChannel = interaction.member?.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ يجب أن تكون متصلاً بروم صوتي (Voice Channel)!', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            let videoUrl = query;
            let videoTitle = query;

            // إذا لم يكن المدخل رابطاً، نقوم بالبحث عبر play-dl
            if (!query.startsWith('http')) {
                let searchResults = await play.search(query, { limit: 1 });
                if (!searchResults || searchResults.length === 0) {
                    return interaction.editReply('❌ لم يتم العثور على نتائج مطابقة!');
                }
                videoUrl = searchResults[0].url;
                videoTitle = searchResults[0].title;
            } else {
                let info = await play.video_info(query);
                videoTitle = info.video_details.title;
            }

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            // جلب تدفق الصوت الحقيقي والمضمون عبر play-dl
            let streamData = await play.stream(videoUrl);
            let resource = createAudioResource(streamData.stream, { 
                inputType: streamData.type 
            });

            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            await interaction.editReply(`🎶 جاري تشغيل الآن: **${videoTitle}**`);

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

            player.on('error', error => {
                console.error('Audio Player Error:', error);
                interaction.followUp({ content: '❌ حدث خطأ أثناء تشغيل الصوت.', ephemeral: true });
                connection.destroy();
            });

        } catch (error) {
            console.error('Command Error:', error);
            await interaction.editReply(`❌ حدث خطأ أثناء محاولة التشغيل:\n\`\`\`${error.message}\`\`\``);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
