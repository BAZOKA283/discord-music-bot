const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const ytSearch = require('yt-search');
const ffmpeg = require('ffmpeg-static');
const express = require('express');

process.env.FFMPEG_PATH = ffmpeg;

// سيرفر إبقائي لاستضافة Fly.io
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Music Bot is running with play-dl!'));

// تم ضبط السيرفر ليستمع على 0.0.0.0 لمنع ظهور خطأ البورت في Fly.io
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

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
        .setDescription('تشغيل أغنية من يوتيوب بجودة عالية وثابتة')
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

            // التحقق مما إذا كان المدخل نص بحث أو رابط
            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                const searchResult = await ytSearch(query);
                if (!searchResult || searchResult.videos.length === 0) {
                    return interaction.editReply('❌ لم يتم العثور على نتائج مطابقة لهذا البحث!');
                }
                videoUrl = searchResult.videos[0].url;
                videoTitle = searchResult.videos[0].title;
            } else {
                try {
                    const info = await play.video_info(query);
                    videoTitle = info.video_details.title;
                } catch {
                    videoTitle = "رابط يوتيوب مباشر";
                }
            }

            // الاتصال بالروم الصوتي
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            // جلب دفق الصوت مع نظام احتياطي للبحث
            let stream;
            try {
                stream = await play.stream(videoUrl);
            } catch (err) {
                const searched = await ytSearch(videoUrl);
                if (searched && searched.videos.length > 0) {
                    videoUrl = searched.videos[0].url;
                    videoTitle = searched.videos[0].title;
                    stream = await play.stream(videoUrl);
                } else {
                    throw err;
                }
            }

            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
            });

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
                interaction.followUp({ content: '❌ حدث خطأ تقني أثناء تشغيل الصوت.', ephemeral: true });
                connection.destroy();
            });

        } catch (error) {
            console.error('Command Error:', error);
            await interaction.editReply(`❌ حدث خطأ أثناء محاولة التشغيل:\n\`\`\`${error.message}\`\`\``);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
