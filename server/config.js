import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// project root, independent of the folder the server was started from (double-click launchers on Mac/Windows)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.join(ROOT, "data");
const FILE = path.join(DATA_DIR, "config.json");

export const DEFAULTS = {
  // connect straight to a TikTok LIVE by username (works without TikFinity)
  direct: {
    enabled: false,
    username: "",
    signApiKey: "", // optional Euler Stream API key (eulerstream.com) for higher limits
    recent: [], // usernames added in admin
  },
  tikfinity: {
    enabled: true,
    url: "ws://localhost:21213/",
  },
  tts: {
    provider: "google", // google | fpt | elevenlabs | openai | browser | off
    rate: 1.2, // playback speed in the game: 1 = normal, higher = faster (below 1 also deepens the voice)
    volume: 1,
    readChat: false,
    maxQueue: 6,
    fptApiKey: "",
    fptVoice: "leminh",
    elevenApiKey: "",
    elevenVoiceId: "",
    elevenModel: "eleven_flash_v2_5",
    openaiApiKey: "",
    openaiVoice: "ash",
    openaiModel: "gpt-4o-mini-tts",
    openaiInstructions:
      "Giọng một ông lão nông dân miền Bắc Việt Nam khoảng 70 tuổi: già yếu, hơi khàn, chậm rãi, hiền lành và xúc động.",
    // other characters (quan huyện, lý trưởng, ông Giáo, Binh Tư) use a second voice where the provider has one
    npcRate: 1.3,
    npcFptVoice: "giahuy",
    npcOpenaiVoice: "onyx",
    npcElevenVoiceId: "",
  },
  // Policy-safe design (TikTok LIVE): nobody is asked for gifts, nothing bad happens if nobody gifts,
  // challenges are won with likes / comments / follows, no threats, no harm to animals,
  // Lão is a story character at a village festival — not a real person in need.
  version: 5,
  // viewer levels: experience from interaction AND gifts; higher levels get a better look and the front-row places
  levels: {
    // no XP for follow / share / subscribe: rewarding them is incentivised engagement (TikTok Integrity & Authenticity)
    xp: { join: 3, chat: 2, per10Likes: 1, follow: 0, share: 0, subscribe: 0, perDiamond: 3 },
    list: [
      { title: "Khách qua đường", xp: 0 },
      { title: "Dân làng", xp: 10 },
      { title: "Trưởng xóm", xp: 50 },
      { title: "Hương sư", xp: 180 },
      { title: "Chánh hội", xp: 500 },
      { title: "Tiên chỉ", xp: 1500 },
    ],
  },
  // big group events: teams chosen in chat; start when the live is lively enough or from the admin
  landlord: {
    enabled: true, // the top giver of this live becomes "Địa chủ của làng": own place + parasol & fan servants
    minDiamonds: 30, // needs at least this much (real gifts only) to get the title
  },
  poems: [
    "Trong đầm gì đẹp bằng sen|Lá xanh bông trắng lại chen nhị vàng|Nhị vàng bông trắng lá xanh|Gần bùn mà chẳng hôi tanh mùi bùn",
    "Công cha như núi Thái Sơn|Nghĩa mẹ như nước trong nguồn chảy ra|Một lòng thờ mẹ kính cha|Cho tròn chữ hiếu mới là đạo con",
    "Bầu ơi thương lấy bí cùng|Tuy rằng khác giống nhưng chung một giàn",
    "Ai ơi bưng bát cơm đầy|Dẻo thơm một hạt, đắng cay muôn phần",
    "Làng ta có lũy tre xanh|Có cây đa cũ, có mái tranh hiền hòa|Chiều về khói bếp nhà nhà|Cậu Vàng vẫy đuôi đón ta đầu làng",
    "Cổng làng rêu phủ tháng năm|Bà con tụ hội quây quần sớm hôm|Một câu chào, một nụ cười|Làng quê ấm áp lòng người thảnh thơi",
    "Trâu ơi ta bảo trâu này|Trâu ra ngoài ruộng trâu cày với ta",
  ],
  quiz: {
    enabled: true,
    everyMinutes: 4, // Ông Giáo comes with a word puzzle this often (0 = only from the admin)
    seconds: 60,
    winXp: 20, // experience for the fastest right answer
    modes: { scramble: true, riddle: true, math: true }, // đố chữ · đố vui · toán nhanh (picked at random)
    riddleSeconds: 45,
    mathSeconds: 25,
    // câu đố vui dân gian / tự viết; "a" may list several accepted answers with |
    riddles: [
      { q: "Con gì đập thì sống, không đập thì chết?", a: "Trái tim|Tim|Quả tim" },
      { q: "Cái gì luôn đi tới mà không bao giờ tới?", a: "Ngày mai" },
      { q: "Cái gì của bạn mà người khác dùng nhiều hơn bạn?", a: "Cái tên|Tên" },
      { q: "Cái gì có cổ mà không có đầu?", a: "Cái áo|Áo" },
      { q: "Cái gì có răng mà không biết cắn?", a: "Cái lược|Lược" },
      { q: "Cái gì có chân mà không biết đi?", a: "Cái bàn|Bàn|Cái ghế|Ghế" },
      { q: "Cái gì đen khi mua, đỏ khi dùng, xám khi bỏ đi?", a: "Than|Cục than|Than củi" },
      { q: "Cái gì có mắt mà không nhìn thấy?", a: "Cây kim|Kim|Cái kim" },
      { q: "Con gì mang cả cái nhà đi khắp nơi?", a: "Con ốc sên|Ốc sên|Con ốc|Ốc|Con rùa|Rùa" },
      { q: "Cái gì nhà nào cũng treo, mỗi năm lại thay một lần?", a: "Tờ lịch|Lịch|Cuốn lịch" },
      { q: "Con gì sáng đi bốn chân, trưa đi hai chân, chiều đi ba chân?", a: "Con người|Người" },
      { q: "Cái gì càng lấy đi càng to ra?", a: "Cái lỗ|Lỗ|Cái hố|Hố" },
      { q: "Cái gì cho người khác rồi mà mình vẫn phải giữ?", a: "Lời hứa" },
      { q: "Con gì sáng sớm gáy ò ó o gọi cả làng dậy?", a: "Con gà trống|Gà trống|Con gà|Gà" },
      { q: "Cây gì mọc thành lũy quanh làng, thân thẳng, ruột rỗng?", a: "Cây tre|Tre|Lũy tre" },
      { q: "Con gì kéo cày ngoài đồng, nhà nông quý như người nhà?", a: "Con trâu|Trâu" },
      { q: "Con gì lão Hạc thương nhất, gọi là cậu?", a: "Cậu Vàng|Con chó|Chó" },
      { q: "Cái gì đội trên đầu, làm bằng lá, che nắng che mưa?", a: "Nón lá|Cái nón|Nón" },
      { q: "Bánh gì vuông vức, gói lá dong, nhà nào cũng có ngày Tết?", a: "Bánh chưng" },
      { q: "Cái gì càng rửa càng bẩn?", a: "Nước" },
    ],
    minLetters: 6,
    maxLetters: 20,
    words: [
      "Cậu Vàng", "Lão Hạc", "Ông Giáo", "Cổng làng", "Cây tre", "Lũy tre làng|Lũy tre",
      "Bánh chưng", "Con trâu", "Đèn trời", "Đua thuyền", "Thả diều", "Giếng làng",
      "Cây đa đầu làng", "Hội làng", "Mái tranh", "Khoai lang", "Nồi cơm", "Trung thu|Tết trung thu",
      "Bánh đa", "Chuối xanh", "Đồng lúa", "Cánh đồng", "Làng quê", "Thương nhau",
      "Tình làng nghĩa xóm", "Nam Cao", "Con gà trống", "Đàn vịt", "Chăn trâu", "Lý trưởng",
      "Quan huyện", "Ao làng", "Nón lá bài thơ|Nón bài thơ", "Bánh giầy|Bánh dầy", "Xôi gấc", "Cơm nắm muối vừng|Cơm nắm muối mè",
      "Đình làng", "Chợ quê", "Bờ tre", "Cánh diều", "Lúa chín", "Mùa gặt",
      "Rơm rạ", "Bếp lửa", "Ấm trà", "Cháo hành", "Bát nước chè|Bát nước trà", "Hàng xóm",
      "Bạn hiền", "Uống nước nhớ nguồn", "Lá lành đùm lá rách", "Thương người như thể thương thân", "Ăn quả nhớ kẻ trồng cây",
    ],
  },
  bigEvents: {
    enabled: true,
    threshold: 250, // likes 1 + comments 3 + follows 10 within the window
    windowSeconds: 120,
    cooldownMinutes: 5,
    giftsCount: false, // gifts never score by default (TikTok gifting policy); turn on for PK-style events
    giftPoints: 1,
    winXp: 30, // bonus XP for everyone in the winning team (lantern success: half, for everyone)
    events: { tug: true, boat: true, lantern: true, niu: true },
    tug: { seconds: 75, target: 150 }, // win when one side leads by this many points
    boat: { seconds: 80, target: 200 }, // first boat to this many points
    lantern: { seconds: 60, target: 300 }, // the whole village together
    niu: { seconds: 70 },
  },
  antiSpam: {
    enabled: true,
    minGapSeconds: 4, // chat lines closer than this do not score
    dupSeconds: 60, // the same text again within this window does not score
    burstCount: 8, // this many lines within burstSeconds = flooding (a strike)
    burstSeconds: 20,
    dupStrike: 3, // the same text this many times = a strike
    strikesToMute: 2, // strikes within strikeWindowMinutes -> points muted
    strikeWindowMinutes: 5,
    muteMinutes: 5,
  },
  episodes: {
    enabled: true,
    followPoints: 0, // follows / shares never score in challenges or team events (no incentivised engagement)
    everyMinutes: 2.5, // a challenge (quan / hội làng / Binh Tư) roughly this often
    ongGiaoMinutes: 3, // ông Giáo introduces the village and how to play
    kidsMinutes: 1.5,
    // challenge points: like = 1, comment = 5, follow / share = 10 (gifts do not count)
    quan: { enabled: true, target: 150, seconds: 60 },
    tax: { enabled: true, target: 120, seconds: 50 },
    binhtu: { enabled: true, target: 100, seconds: 35, keywords: ["đuổi", "duoi", "trộm", "trom", "bắt", "đánh"] },
    scenes: { poem: true, scuffle: true, dogFlip: true, dogChase: true, quay: true, kids: true, kidsHug: true, kidsBall: true, herd: true, fight: true, rain: true, kite: true, butterflies: true },
  },
  game: {
    title: "Lão Hạc & Cậu Vàng",
    plaque: "CỔNG LÀNG",
    idleLineSeconds: 25,
    lamentSeconds: 60, // nobody interacted for this long: Lão sighs and laments (lines.lament)
    moodDecayPerMinute: 4, // the "vui" (happiness) bars slowly fall, any interaction raises them
    likeMilestone: 300,
    thankJoins: false,
    ambientVillagers: 6,
    animals: true, // villagers walking a buffalo, carrying a pig, herding ducks
    animalChance: 0.22, // share of passers-by that come with an animal
    barkKeywords: ["vàng", "vang", "gâu", "gau", "cậu vàng", "cau vang"],
    callKeywords: ["lão", "ông ơi", "ong oi", "lao hac", "lão hạc", "cụ ơi"],
    // words never shown in bubbles / read aloud (names and chat): whole words, exact spelling incl. accents, any case
    blockedWords: ["đm", "dm", "đmm", "dmm", "vcl", "vkl", "đéo", "địt", "đụ", "đụ má", "lồn", "cặc", "buồi", "fuck", "shit", "bitch"],
    greetPassers: true,
    maxNamedVillagers: 12, // viewers standing behind Lão at the same time
    walkSpeed: 1.35, // walking speed of every villager (1 = old speed)
    crowdStaySeconds: 300, // TikTok sends no "left" event: a viewer leaves after this long without interacting
    chickens: 5,
    dogNapSeconds: 60,
    danceDiamonds: 300, // diamonds within 60 s that make Cậu Vàng stand up and dance
    danceLikes: 500, // ...or this many likes within 60 s
    danceSeconds: 14,
    buffaloDanceChance: 0.35, // a passing buffalo sometimes stops, stands up and dances hip-hop
    showSeedOnStream: false, // admin "seeding" gifts never show on the public leaderboard / goal unless turned on
    goals: [
      { name: "Thắp đèn lồng cổng làng", target: 300 },
      { name: "Treo cờ hội làng", target: 800 },
      { name: "Dựng sân khấu hội làng", target: 2000 },
      { name: "Mở hội làng mùa xuân", target: 5000 },
      { name: "Pháo hoa đêm hội làng", target: 12000 },
    ],
  },
  // diamonds of one gift event (diamondCount x repeatCount) -> what the villager brings to the village festival
  tiers: [
    { min: 0, item: "Coin", label: "Xu may mắn" },
    { min: 5, item: "Khoai", label: "Khoai nướng" },
    { min: 20, item: "Chuoi", label: "Nải chuối" },
    { min: 50, item: "BanhChung", label: "Bánh chưng" },
    { min: 100, item: "Gao", label: "Bao gạo nếp" },
    { min: 500, item: "Gao", label: "Mâm cỗ hội làng", big: true },
  ],
  lines: {
    gift: [
      "Cảm ơn {name} nhé! Món quà làm cả làng vui hẳn lên!",
      "Ôi, {name} chu đáo quá! Cậu Vàng ơi, vẫy đuôi cảm ơn {name} đi con!",
      "{name} mang {item} tới hội làng kìa! Lão cảm ơn {name} nhiều!",
      "Chúc {name} mạnh khỏe, gặp nhiều may mắn nhé!",
      "Cảm ơn {name}! Hội làng mình thêm đông vui rồi!",
    ],
    bigGift: [
      "Ối chà, {name} chơi lớn quá! Cả làng mở hội thôi!",
      "{name} ơi, lão cảm ơn nhiều lắm! Cả làng ơi, ra chúc mừng {name} nào!",
    ],
    dogGift: [
      "{name} cho cậu Vàng khúc xương kìa! Vàng ơi, cảm ơn {name} đi con!",
      "Cậu Vàng mừng quá, vẫy đuôi cảm ơn {name} đấy!",
    ],
    follow: [
      "Cảm ơn {name} đã theo dõi! Chào mừng {name} về làng!",
      "{name} theo dõi rồi! Cậu Vàng, chào {name} đi con!",
    ],
    share: [
      "{name} chia sẻ cho bạn bè, lão cảm ơn nhiều lắm!",
      "Cảm ơn {name} đã chia sẻ, để thêm nhiều người ghé làng chơi.",
    ],
    subscribe: ["{name} đăng ký hội viên! Cảm ơn {name}, chào mừng vào hội làng!"],
    join: ["Chào {name}! Ghé ngồi chơi với lão và cậu Vàng nhé."],
    // nobody has interacted for a while: Lão sits sadly and laments (story of Nam Cao's "Lão Hạc")
    lament: [
      "Haiz… thằng con lão đi phu đồn điền cao su biền biệt, chẳng biết bao giờ mới về…",
      "Làng vắng quá… chỉ còn lão với cậu Vàng ngồi nhìn nhau.",
      "Vàng ơi, mày có biết lão buồn không? Chẳng ai ghé chơi với ông cháu mình cả…",
      "Cái thằng Binh Tư hôm nọ lại sang dòm con Vàng… Lão bảo nó: đừng có hòng!",
      "Binh Tư nó bảo lão già rồi, nuôi chó làm gì cho tốn gạo… Nhưng Vàng là bạn của lão mà.",
      "Lão sang nhà Binh Tư xin miếng nước chè, nó cứ hỏi mua cậu Vàng mãi… Lão không bán đâu!",
      "Mảnh vườn này lão giữ cho thằng con, đói mấy lão cũng không bán…",
      "Gạo đắt quá, bữa nay lão với Vàng lại ăn củ khoai thôi…",
      "Bà con đâu cả rồi… gõ một chữ cho lão vui với nào.",
      "Ông Giáo bảo lão: cuộc đời chưa hẳn đã đáng buồn… Lão cũng mong thế.",
    ],
    idle: [
      "Bà con gõ chữ Vàng ơi, xem cậu Vàng sủa chào kìa!",
      "Thả tim cho cậu Vàng vẫy đuôi nào bà con!",
      "Ai gõ Lão ơi thì lão trả lời ngay nhé!",
      "Trời hôm nay đẹp quá, gió đồng thổi mát rượi.",
      "Bà con ở đâu đấy? Bình luận cho lão biết với, lão thích nghe chuyện các nơi lắm.",
      "Vàng ơi, ngồi thẳng lưng lên, bà con đang xem kìa con!",
      "Cổng làng mình đẹp không bà con? Cây đa này có từ đời ông cố lão đấy.",
    ],
    lowMood: [
      "Làng hôm nay yên ắng quá... Vàng ơi, ông cháu mình kể chuyện cho bà con nghe nhé.",
      "Vàng ngáp rồi kìa. Bà con bình luận vài câu cho làng rôm rả lên nào!",
    ],
    like: [
      "Cảm ơn bà con thả tim! Cậu Vàng vui lắm kìa!",
      "Tim nhiều quá, lão ấm lòng lắm bà con ơi!",
    ],
    chatCall: [
      "Lão đây, {name} gọi lão à?",
      "{name} ơi, lão nghe đây. Ngồi chơi với lão nhé.",
      "Ơi, {name}! Lão già rồi, tai nghễnh ngãng lắm.",
    ],
    // a viewer calls Cậu Vàng ("Vàng ơi"): Vàng barks, Lão says one of these out loud
    chatDog: [
      "Vàng ơi, {name} gọi mày kìa!",
      "Cậu Vàng, chào {name} đi con!",
      "Đấy, {name} gọi là cậu Vàng vẫy đuôi ngay!",
    ],
    levelUp: [
      "Bà con ơi! Làng mình đã {goal}! Cảm ơn cả làng!",
    ],
    funny: [
      "Hồi trẻ lão cũng đẹp trai lắm nhé, cả làng này ai cũng biết.",
      "Vàng ơi, đừng vẫy đuôi với con gà nữa, nó không chơi với mày đâu!",
      "Lão nói nhỏ thôi nhé, cậu Vàng nhà lão biết nghe tiếng người đấy.",
      "Ai thả tim thì cậu Vàng nhớ mặt, mai gặp ngoài đường nó vẫy đuôi chào.",
      "Cậu Vàng hôm qua đuổi gà nhà ông Giáo, lão phải sang xin lỗi mãi.",
      "Lão già nhưng mắt còn tinh lắm, ai vừa vào live lão thấy hết!",
      "Bà con biết không, cậu Vàng nghe được cả tiếng gõ phím đấy. Thử gõ Vàng ơi xem!",
    ],
    passerGreet: [
      "Kìa {name}! Đi chợ về đấy à?",
      "{name} ơi, ghé lại chơi với lão một tí!",
      "Chào {name}! Trông {name} hôm nay phong độ thế!",
      "{name} đi đâu mà vội thế? Cậu Vàng vẫy đuôi chào kìa!",
    ],
    dance: [
      "Ối giời ơi! Cậu Vàng đứng dậy nhảy hiphop kìa bà con ơi!",
      "Quẩy lên Vàng ơi! Làng mình đông vui thế này thì phải nhảy chứ!",
      "Cậu Vàng nhà lão đỉnh chưa! Nhảy còn hay hơn thanh niên trong làng!",
    ],
    // ---- quan huyện: wants to buy Cậu Vàng; the village shows how much they love him (likes / comments)
    quanArrive: [
      "Lão Hạc kia! Con chó vàng béo tốt thế này, bán cho quan, quan trả năm hào!",
      "Ái chà, con chó đẹp quá! Lão Hạc, bán cho quan nhé!",
    ],
    laoRefuseQuan: [
      "Bẩm quan... cậu Vàng là của thằng con lão để lại, lão không bán đâu ạ.",
      "Bẩm quan, con chó là bạn của lão, lão không bán được ạ.",
    ],
    quanDemand: [
      "Làng này vui vẻ thế nào, cho ta xem nào! Cả làng cổ vũ đủ {target} điểm thì ta về phủ, không hỏi mua nữa!",
      "Được! Trong {seconds} giây, cả làng cổ vũ đủ {target} điểm thì ta không hỏi mua nữa!",
    ],
    quanTaunt: [
      "Còn {left} giây! Làng này cổ vũ hăng quá nhỉ!",
      "{progress} điểm rồi! Làng này vui thật!",
    ],
    quanCheer: [
      "Bà con thả tim, gõ Giữ Vàng cho quan biết làng mình thương cậu Vàng nhé!",
      "Vàng ơi, sủa to lên chào quan đi con!",
    ],
    quanLose: [
      "Ái chà, cả làng thương nó thật! Thôi được, ta không mua nữa. Về phủ!",
      "Làng này đoàn kết quá! Thôi, ta chịu. Lính đâu, về!",
    ],
    laoQuanWin: [
      "Cảm ơn bà con! Cậu Vàng ở lại với lão rồi!",
      "Nhờ bà con cổ vũ cả! Vàng ơi, con ở với ông nhé!",
    ],
    quanFail: [
      "Thôi, hôm nay làng bận cả. Ta về phủ, hôm khác ta lại ghé chơi!",
      "Hết giờ rồi! Con chó quý thế thì cứ để lão giữ. Ta về!",
    ],
    laoQuanFail: [
      "Quan về rồi! Cậu Vàng vẫn ở với lão, bà con yên tâm nhé!",
      "Hú hồn! Cậu Vàng vẫn ở đây với ông cháu mình!",
    ],
    // ---- lý trưởng: decides whether the village holds a festival (likes / comments)
    taxDemand: [
      "Lão Hạc! Năm nay làng có mở hội không? Ta phải xem làng có vui không đã! Đủ {target} điểm tim với bình luận thì mở hội!",
      "Làng mình muốn mở hội thì phải rôm rả lên! Ta đếm đủ {target} điểm là ta cho mở hội!",
    ],
    laoAskVillage: [
      "Bà con ơi, thả tim, bình luận cho làng mình được mở hội nào!",
      "Bà con ở đâu thì bình luận cho ông lý biết làng mình đông vui nhé!",
    ],
    taxTaunt: [
      "Còn {left} giây! Ta đếm đây!",
      "{progress} điểm rồi! Vui dần lên rồi đấy!",
    ],
    taxPaid: [
      "Làng vui thế này thì mở hội thôi! Ta ghi sổ rồi!",
      "Được! Đủ điểm rồi, làng mình mở hội!",
    ],
    laoTaxPaid: [
      "Mở hội rồi bà con ơi! Cảm ơn cả làng!",
    ],
    taxFail: [
      "Thôi được, để dịp khác làng mình mở hội vậy!",
      "Hôm nay chưa mở hội, hẹn bà con dịp khác nhé!",
    ],
    laoTaxFail: [
      "Không sao, hôm khác làng mình mở hội bà con nhé!",
    ],
    // ---- Binh Tư: sneaks up to Cậu Vàng; likes / comments "đuổi" chase him off
    binhTuSneak: [
      "Hê hê... con chó vàng đẹp quá... dắt về chơi mấy hôm...",
      "Suỵt... nhẹ chân thôi... con chó vàng ơi, lại đây với anh...",
    ],
    laoSpotThief: [
      "Kìa! Thằng Binh Tư lại lảng vảng quanh cậu Vàng! Bà con hô to lên cho vui nào!",
      "Binh Tư! Mày định làm gì cậu Vàng nhà tao? Vàng ơi, sủa to lên con!",
    ],
    binhTuFlee: [
      "Ối, đông người quá! Chạy thôi!",
      "Thôi thôi, tôi đi, tôi đi!",
    ],
    laoThiefGone: [
      "Cảm ơn bà con! Thằng Binh Tư chạy mất dép rồi!",
      "Ha ha, cả làng hô một tiếng là nó chạy biến!",
    ],
    binhTuGrab: [
      "Hê hê, tóm được rồi! Đi theo anh nào, cún ngoan!",
    ],
    // ---- Cậu Vàng led away (any challenge that misses its target) and escaping at the gate
    laoSadDogTaken: [
      "Vàng ơi... Vàng ơi! Các ông ơi, trả cậu Vàng cho lão...",
      "Ối giời ơi... cậu Vàng của lão... con ơi...",
    ],
    takerOuch: [
      "Ối! Con chó vùng ra rồi! Nó chạy mất rồi!",
      "Á! Đứt dây rồi! Đuổi theo... thôi, chạy nhanh quá!",
    ],
    laoDogBack: [
      "Vàng! Vàng về rồi! Giỏi lắm con, về với ông đây!",
      "Ha ha! Cậu Vàng nhà lão vùng ra chạy về rồi! Không ai dắt đi được đâu!",
    ],
    // ---- ông Giáo: introduces the village and how to play (never asks for gifts)
    ongGiaoAppeal: [
      "Chào bà con! Tôi là ông Giáo, hàng xóm của lão Hạc. Đây là làng của lão Hạc và cậu Vàng, dựng lại từ truyện ngắn của nhà văn Nam Cao. Bà con gõ Vàng ơi để cậu Vàng chào, gõ Lão ơi để trò chuyện với lão nhé!",
      "Thưa bà con, lão Hạc trong truyện là người hiền lành, thương con, thương cậu Vàng lắm. Ở làng này, bà con thả tim là cậu Vàng vẫy đuôi, bình luận là lão trò chuyện cùng bà con đấy!",
      "Tôi là ông Giáo đây. Mỗi lúc quan huyện hay Binh Tư ghé làng, bà con thả tim với bình luận cổ vũ cho làng thêm vui. Chúc bà con xem vui!",
    ],
    ongGiaoChat: [
      "G: Cụ Hạc, hôm nay làng đông vui nhỉ!|L: Phải đấy ông Giáo ạ, bà con ghé chơi đông lắm.|G: Thế thì cụ kể chuyện cho bà con nghe đi.",
      "G: Cụ Hạc, thằng con có thư về không cụ?|L: Chưa ông ạ... nó đi lâu quá rồi...|G: Cụ cứ yên tâm, rồi nó sẽ về ăn Tết thôi.",
      "G: Cậu Vàng dạo này nhanh nhẹn quá!|L: Nó mới học lùa gà đấy ông Giáo ạ!|G: Thế thì phải cho bà con xem mới được.",
    ],
    herdLao: [
      "Vàng ơi, lùa gà về chuồng cho bà Giáo đi con!",
      "Ha ha, cậu Vàng nhà lão chăn gà giỏi nhất làng!",
      "Từ từ thôi Vàng! Gà rụng hết lông bây giờ!",
    ],
    hugKid: [
      "Cậu Vàng dễ thương quá! Cho cháu bế tí!",
      "Vàng ơi lên đây! Bay nè bay nè!",
    ],
    hugLao: [
      "Bế cẩn thận đấy nhé, cậu Vàng là báu vật của lão đấy!",
      "Ha ha, cậu Vàng thích được bế lắm, nhìn đuôi nó kìa!",
    ],
    ballKid: [
      "Vàng ơi, bắt bóng này!",
      "Chuyền cho Vàng này! Bắt lấy!",
    ],
    ballLao: [
      "Ha ha, cậu Vàng bắt bóng giỏi chưa!",
      "Chơi ngoan nhé các cháu, đừng ném xa quá đấy!",
    ],
    rainLao: [
      "Ối, mưa rồi! Bà con chạy vào hiên đi kẻo ướt!",
      "Mưa rào mùa hạ đây! Vàng ơi, nép vào đây với ông!",
    ],
    rainbowLao: [
      "Tạnh mưa rồi! Bà con nhìn kìa, cầu vồng đẹp quá!",
      "Mưa xong có cầu vồng, ước gì được nấy bà con ơi!",
    ],
    kiteKid: [
      "Diều bay cao chưa! Vàng ơi nhìn kìa!",
      "Lên nữa đi diều ơi! Cao lên nữa!",
    ],
    kiteLao: [
      "Hồi bé lão cũng thả diều sáo trên đê đấy, vui lắm!",
      "Diều bay cao quá! Gió hôm nay đẹp thật.",
    ],
    butterflyLao: [
      "Kìa, bướm bay! Vàng ơi, đuổi được con nào chưa?",
      "Ha ha, Vàng đuổi bướm cả buổi mà chẳng bắt được con nào!",
    ],
    roosterLao: [
      "Gà nhà ai gáy to thế nhỉ!",
      "Ò ó o! Gà gáy rồi, bà con ăn cơm chưa?",
    ],
    fightStart: [
      "Ê {other}! Dám thi kéo co với tao không?",
      "{other} ơi! Ra đây kéo co xem ai khỏe hơn!",
      "{other}! Thi kéo co cho vui, thắng thua bắt tay nhé!",
    ],
    fightReply: [
      "Chơi luôn! Kéo cho vui nào!",
      "Được! Hôm nay tao ăn hai bát cơm rồi đấy!",
      "Sợ gì! Kéo thì kéo!",
    ],
    fightLao: [
      "Hội làng thi kéo co đây! Bà con cổ vũ nào!",
      "Hò dô ta nào! Bà con bình luận cổ vũ đi!",
    ],
    fightWin: [
      "{winner} thắng sát nút! {loser} cũng kéo cừ lắm!",
      "Hoan hô {winner}! {loser} kéo hay không kém!",
    ],
    fightMakeUp: [
      "Thắng thua vui là chính! Hai đứa bắt tay nào!",
      "Hay lắm! Làng mình khỏe thế này thì năm nay được mùa rồi!",
    ],
    levelUpLao: [
      "Chúc mừng {name} lên {title}! Cả làng vỗ tay nào!",
      "Ồ, {name} giờ là {title} rồi! Mời {name} lên đứng hàng trên!",
      "{name} được làng phong {title}! Lão mừng lắm!",
    ],
    bigAnnounce: [
      "Ối, làng mình đông vui quá! Mở sự kiện lớn thôi bà con ơi!",
      "Bà con nhiệt tình thế này thì làng tổ chức {event} luôn!",
    ],
    teamJoin: [
      "{name} vào {team} rồi!",
      "Chào {name}, {team} có thêm người rồi đấy!",
    ],
    tugCall: [
      "Gõ Đông hoặc Tây để chọn phe kéo co nào bà con! Thả tim là kéo dây đấy!",
      "Xóm Đông gõ số 1, Xóm Tây gõ số 2! Tim với bình luận là sức kéo!",
    ],
    tugLead: [
      "{team} đang kéo mạnh quá! {top} khỏe ghê!",
      "{team} dẫn rồi! Phe kia cố lên!",
      "Dây đang nghiêng về {team}! Hò dô ta nào!",
    ],
    landlordNew: [
      "Kính chào địa chủ {name}! Lính đâu, che lọng quạt mát cho địa chủ nào!",
      "Làng mình có địa chủ {name} rồi! Cảm ơn {name} đã thương Lão với Cậu Vàng!",
    ],
    landlordBack: [
      "Địa chủ {name} về làng! Lính hầu ra đón nào!",
    ],
    spamWarn: [
      "Bình tĩnh nào {name}! Chat chậm thôi con, spam là không được tính điểm đâu nhé!",
      "{name} ơi, gõ từ từ thôi! Cả làng cùng chơi cho vui nào!",
    ],
    spamMute: [
      "Thôi, {name} spam nhiều quá, lão tạm khóa điểm {minutes} phút nhé! Lát quay lại chơi đàng hoàng nha!",
    ],
    quizStartRiddle: [
      "Đố vui có thưởng đây! Bà con nghe ông đố nhé, ai trả lời đúng nhanh nhất ông khen!",
      "Câu đố vui của ông Giáo đây! Nghĩ nhanh, gõ đáp án vào bình luận nào!",
    ],
    quizStartMath: [
      "Toán nhanh nào bà con! Ai tính đúng nhanh nhất thì giỏi nhất làng!",
      "Thử tài tính nhẩm nào! Gõ kết quả vào bình luận thật nhanh nhé!",
    ],
    // Ông Giáo đọc thơ: ca dao dân gian + lục bát tự viết (dùng | để xuống dòng)
    giaoPoemIntro: [
      "Bà con nghe ông đọc mấy câu thơ cho vui nhé!",
      "Hôm nay trời đẹp, ông đọc bà con nghe vài câu thơ.",
    ],
    giaoShout: [
      "{name} ơi, ông thấy con bình luận vui lắm, ông khen nhé!",
      "Ông gửi lời chào {name}! Ở lại chơi với làng lâu lâu nhé!",
      "{name} hôm nay sôi nổi quá, cả làng vỗ tay cho {name} nào!",
      "Chào {name}! Ông nhớ tên con rồi đấy, mai nhớ ghé làng nhé!",
    ],
    scuffleStart: [
      "Ối ối, hai ông hàng xóm lại cãi nhau rồi! Bà con gõ can để can giúp lão với!",
      "Kìa, đụng nhau một cái là cãi nhau ầm ĩ! Bà con gõ can ra đi!",
    ],
    scuffleEnd: [
      "Thôi thôi, hàng xóm láng giềng cả, bắt tay làm lành nào!",
      "Cãi nhau tí cho vui thôi, giờ lại ngồi uống nước chè với nhau rồi!",
    ],
    quizStart: [
      "Ông đố cả làng! Xếp các chữ này thành từ đúng, ai gõ đúng nhanh nhất ông khen!",
      "Đố vui có thưởng kinh nghiệm đây! Sắp xếp lại các chữ, gõ đáp án vào bình luận nhé!",
      "Nào, kiểm tra chữ nghĩa cả làng xem! Ai đoán ra trước nào?",
    ],
    quizWrong: [
      "Chưa đúng rồi {name} ơi! Thử lại nào!",
      "{name} ơi, nhìn kỹ các chữ thêm chút nhé!",
      "Chưa đúng đâu {name}! Ông cho thêm một cơ hội!",
      "Ấy, chưa phải rồi {name}! Ông Giáo lắc đầu đây!",
      "Không phải rồi {name}! Bình tĩnh, nghĩ thêm chút nữa!",
    ],
    quizClose: [
      "Gần đúng rồi {name}! Sửa thêm chút nữa!",
      "{name} sắp ra rồi đấy, cố lên!",
    ],
    quizHint: [
      "Ông gợi ý thêm vài chữ nhé!",
      "Khó quá à? Ông hé thêm chữ đây!",
    ],
    quizWin: [
      "Giỏi lắm {name}! Đáp án là {answer}! Cả làng khen {name} nào!",
      "Chính xác! {name} nhanh trí nhất làng! Đáp án: {answer}!",
      "Hoan hô {name}! Đúng là {answer}! Ông thưởng kinh nghiệm cho con!",
    ],
    quizNobody: [
      "Hết giờ! Đáp án là {answer}. Lần sau cố lên nhé cả làng!",
      "Chưa ai đoán ra! Đáp án là {answer} đấy!",
    ],
    bigShout: [
      "Xin vinh danh {team}: {names}! Cả làng vỗ tay nào!",
      "Bảng vàng hôm nay gọi tên {team}: {names}! Giỏi quá các con ơi!",
      "Hoan hô {names}! {team} xứng đáng được thưởng!",
    ],
    tugWin: [
      "{team} thắng kéo co rồi! Cả làng vỗ tay nào!",
      "Hoan hô {team}! {top} kéo giỏi nhất!",
    ],
    boatCall: [
      "Đua thuyền đây! Gõ Đỏ, Vàng, Xanh hoặc Tím, hoặc số 1 đến 4 để lên thuyền! Thả tim là chèo!",
      "Bà con chọn thuyền đi! Đỏ số 1, Vàng số 2, Xanh số 3, Tím số 4!",
    ],
    boatLead: [
      "{team} đang dẫn đầu! {top} chèo khỏe quá!",
      "{team} vượt lên rồi bà con ơi!",
      "Sát nút quá! {team} đang nhỉnh hơn một chút!",
    ],
    boatWin: [
      "{team} về nhất! Hoan hô {top}!",
      "{team} thắng đua thuyền rồi! Cả làng mừng nào!",
    ],
    lanternCall: [
      "Thả đèn trời nào bà con! Mỗi tim, mỗi bình luận là một chút lửa cho đèn bay!",
      "Bà con thả tim đi, đèn trời bay lên mang theo điều ước của bà con đấy!",
    ],
    lanternWin: [
      "Đèn trời bay đầy trời rồi! Đẹp quá bà con ơi! Chúc cả làng bình an!",
    ],
    lanternPart: [
      "Đèn trời bay lên rồi! Lần sau mình thả nhiều hơn nữa nhé!",
    ],
    niuCall: [
      "Bịt mắt đập niêu đây! {name} bị bịt mắt rồi, bà con gõ trái, phải, lên, xuống để chỉ đường, gõ đập để đập!",
    ],
    niuHint: [
      "Gần lắm rồi! Bà con chỉ đường tiếp đi!",
      "Ối, đi lệch rồi! Bà con chỉ lại đi!",
      "Sắp tới niêu rồi kìa!",
    ],
    niuWin: [
      "Bốp! Vỡ niêu rồi! {name} giỏi quá, cảm ơn bà con chỉ đường!",
    ],
    niuFail: [
      "Hết giờ rồi! Niêu vẫn còn nguyên, lần sau bà con chỉ đường kỹ hơn nhé!",
    ],
    kidsLao: [
      "Chúng mày chạy chậm thôi, ngã bây giờ!",
      "Ha ha, trẻ con làng này nghịch như quỷ!",
      "Vàng ơi, đừng chạy theo bọn trẻ, ngồi yên đây!",
    ],
  },
};

function deepMerge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (typeof base !== "object" || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

let config = structuredClone(DEFAULTS);

export function loadConfig() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
      if ((saved.version || 1) < 2) {
        // v1 -> v2: new policy-safe lines, challenges, goals and gift labels; keep everything else (keys, TikFinity, voice…)
        fs.writeFileSync(path.join(DATA_DIR, "config.backup-v1.json"), JSON.stringify(saved, null, 2));
        delete saved.lines;
        delete saved.episodes;
        delete saved.tiers;
        if (saved.game) {
          delete saved.game.goals;
          delete saved.game.sellThreatMinutes;
          delete saved.game.hungerDecayPerMinute;
        }
        saved.version = 2;
        console.log("config.json upgraded to v2 (backup: data/config.backup-v1.json)");
      }
      if (saved.version < 3) {
        // v2 -> v3: faster voice (only if still on the old defaults), bigger crowd behind Lão
        if (saved.tts?.rate === 0.88) saved.tts.rate = DEFAULTS.tts.rate;
        if (saved.tts?.npcRate === 1.06) saved.tts.npcRate = DEFAULTS.tts.npcRate;
        if (saved.game?.maxNamedVillagers === 10) saved.game.maxNamedVillagers = DEFAULTS.game.maxNamedVillagers;
        saved.version = 3;
        console.log("config.json upgraded to v3 (faster voice, crowd behind Lão)");
      }
      if (saved.version < 5) {
        // v4 -> v5: a bit faster voice, lower village goals, the fight scene became tug-of-war
        if (saved.tts?.rate === 1.12) saved.tts.rate = DEFAULTS.tts.rate;
        if (saved.tts?.npcRate === 1.22) saved.tts.npcRate = DEFAULTS.tts.npcRate;
        const oldTargets = [1000, 3000, 8000, 20000, 50000];
        if (saved.game?.goals && saved.game.goals.every((g, i) => g.target === oldTargets[i])) delete saved.game.goals;
        if (saved.lines) for (const k of ["fightStart", "fightReply", "fightLao", "fightWin", "fightMakeUp"]) delete saved.lines[k];
      }
      if (saved.version < 4) {
        // v3 -> v4: missed challenges now lead Cậu Vàng away until he escapes at the gate — refresh those lines
        if (saved.lines) for (const k of ["quanFail", "laoQuanFail", "taxFail", "laoTaxFail", "laoDogBack"]) delete saved.lines[k];
        saved.version = 4;
        console.log("config.json upgraded to v4 (Cậu Vàng led away & escapes)");
      }
      if (saved.version < 5) {
        saved.version = 5;
        console.log("config.json upgraded to v5 (faster voice, lower goals, tug-of-war)");
      }
      config = deepMerge(DEFAULTS, saved);
      // drop keys that no longer exist in this version
      for (const k of Object.keys(config.lines)) if (!(k in DEFAULTS.lines)) delete config.lines[k];
    } catch (e) {
      console.error("config.json unreadable, using defaults:", e.message);
    }
  }
  saveConfig();
  return config;
}

export function getConfig() {
  return config;
}

export function updateConfig(patch) {
  config = deepMerge(config, patch);
  saveConfig();
  return config;
}

export function resetSection(section) {
  if (section in DEFAULTS) config[section] = structuredClone(DEFAULTS[section]);
  saveConfig();
  return config;
}

function saveConfig() {
  fs.writeFileSync(FILE, JSON.stringify(config, null, 2));
}

/** Config without secrets - what the game page receives. */
export function publicConfig() {
  const c = structuredClone(config);
  for (const k of Object.keys(c.tts)) if (/ApiKey$/.test(k)) c.tts[k] = c.tts[k] ? "***" : "";
  if (c.direct) c.direct.signApiKey = c.direct.signApiKey ? "***" : "";
  return c;
}
