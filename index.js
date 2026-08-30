const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const ffmpeg = require('ffmpeg-static');
const express = require('express');

process.env.FFMPEG_PATH = ffmpeg;

// سيرفر إبقائي لتبقى استضافة Railway شغالة 24/7
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Music Bot is running perfectly!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// تعريف أمر /play
const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('تشغيل أغنية من يوتيوب بجودة عالية')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('اسم الأغنية أو رابط يوتيوب مباشر')
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
        console.log('Successfully registered Slash (/) commands.');
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
            return interaction.reply({ content: '❌ يجب أن تكون متصلاً بروم صوتي (Voice Channel) أولاً!', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            let videoUrl = query;
            let videoTitle = query;

            // البحث عن الأغنية أو التحقق من الرابط
            if (!ytdl.validateURL(query)) {
                const searchResult = await ytSearch(query);
                if (!searchResult || searchResult.videos.length === 0) {
                    return interaction.editReply('❌ لم يتم العثور على نتائج مطابقة لهذا البحث!');
                }
                videoUrl = searchResult.videos[0].url;
                videoTitle = searchResult.videos[0].title;
            } else {
                const videoInfo = await ytdl.getInfo(query);
                videoTitle = videoInfo.videoDetails.title;
            }

            // الاتصال بالروم الصوتي
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            // سحب دفق الصوت مع الخيارات الآمنة للاستضافات
            const stream = await ytdl(videoUrl, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
                dlChunkSize: 0,
            });

            const resource = createAudioResource(stream);
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            await interaction.editReply(`🎶 جاري تشغيل الآن: **${videoTitle}**`);

            // مغادرة الروم عند انتهاء الأغنية
            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

            player.on('error', error => {
                console.error('Audio Player Error:', error);
                interaction.followUp({ content: '❌ حدث خطأ تقني أثناء تشغيل الأغنية.', ephemeral: true });
                connection.destroy();
            });

        } catch (error) {
            console.error('Command Error:', error);
            await interaction.editReply(`❌ حدث خطأ أثناء محاولة التشغيل:\n\`\`\`${error.message}\`\`\``);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
