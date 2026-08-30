const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('3play')) {
        const args = message.content.split(' ');
        const query = args.slice(1).join(' ');

        if (!query) {
            return message.reply('❌ يرجى كتابة اسم أو رابط الأغنية بعد الأمر مثال: `3play faded` أو أرسل رابط يوتيوب');
        }

        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ يجب أن تكون متصلاً بروم صوتي (Voice Channel)!');
        }

        try {
            const msg = await message.channel.send('🔍 جاري البحث والتحميل...');

            let videoUrl = query;
            let videoTitle = query;

            // إذا لم يكن المدخل رابطاً، نقوم بالبحث عنه عبر yt-search
            if (!ytdl.validateURL(query)) {
                const searchResult = await ytSearch(query);
                if (!searchResult || searchResult.videos.length === 0) {
                    return msg.edit('❌ لم يتم العثور على نتائج مطابقة!');
                }
                videoUrl = searchResult.videos[0].url;
                videoTitle = searchResult.videos[0].title;
            } else {
                // إذا كان رابطاً مباشراً، نجلب معلوماته
                const videoInfo = await ytdl.getInfo(query);
                videoTitle = videoInfo.videoDetails.title;
            }

            // الاتصال بالروم الصوتي
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            // سحب البث الصوتي عبر ytdl-core
            const stream = ytdl(videoUrl, { 
                filter: 'audioonly', 
                highWaterMark: 1 << 25,
                quality: 'highestaudio' 
            });

            const resource = createAudioResource(stream);
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            await msg.edit(`🎶 جاري تشغيل الآن: **${videoTitle}**`);

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

            player.on('error', error => {
                console.error('Audio Player Error:', error);
                message.channel.send('❌ حدث خطأ أثناء تشغيل الصوت.');
                connection.destroy();
            });

        } catch (error) {
            console.error('Command Error:', error);
            message.reply(`❌ حدث خطأ أثناء محاولة تشغيل الأغنية:\n\`\`\`${error.message}\`\`\``);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
