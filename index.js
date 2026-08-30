const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const express = require('express');

// سيرفر وهمي حتى يظل البوت شغال وما ينطفئ
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

    // أمر التشغيل: !play [رابط الأغنية أو اسم البحث]
    if (message.content.startsWith('!play')) {
        const args = message.content.split(' ');
        const query = args.slice(1).join(' ');

        if (!query) {
            return message.reply('❌ يرجى كتابة اسم أو رابط الأغنية بعد الأمر! مثال: `!play faded`');
        }

        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ يجب أن تكون متصلاً بروم صوتي (Voice Channel) أولاً!');
        }

        try {
            message.channel.send('🔍 جاري البحث والتحميل...');

            // البحث عن المقطع باستخدام play-dl
            let searchResult = await play.search(query, { limit: 1 });
            if (!searchResult.length) {
                return message.reply('❌ لم يتم العثور على نتائج مطابقة!');
            }

            const songUrl = searchResult[0].url;

            // الاتصال بالروم الصوتي
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            // دفق الصوت
            const stream = await play.stream(songUrl);
            const resource = createAudioResource(stream.stream, { inputType: stream.type });
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            message.reply(`🎶 **جاري تشغيل الآن:** ${searchResult[0].title}`);

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

            player.on('error', error => {
                console.error(error);
                message.channel.send('❌ حدث خطأ أثناء تشغيل الصوت.');
                connection.destroy();
            });

        } catch (error) {
            console.error(error);
            message.reply('❌ حدث خطأ أثناء محاولة تشغيل الأغنية.');
        }
    }
});

// ضع توكن بوتك هنا بدل المربعين أو في متغيرات البيئة (Environment Variables) برندر
client.login('NzIwMjU4NTQ5MDc4NTU2Nzc1.GtL4tr.03BbZHtd9rcfE4-7C2xAFGp3MlQ_dyg76nEbDc');


