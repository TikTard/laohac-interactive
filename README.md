# Lão Hạc & Cậu Vàng — TikTok LIVE web game

Làng quê của Lão Hạc và Cậu Vàng (dựng lại từ truyện ngắn của Nam Cao) ở cổng làng. Người dân đi qua đi lại, người xem vào live thành người dân mang tên mình; Lão trò chuyện bằng **giọng AI**, Cậu Vàng sủa chào, chơi bóng, lùa gà. Quà tặng chỉ tạo hiệu ứng mừng hội làng.

> **Chính sách TikTok LIVE:** game không xin quà, không đe dọa, không có hậu quả xấu nếu không ai tặng, không có nội dung hại động vật. Thử thách chỉ tính tim / bình luận / follow. Khi sửa câu thoại (Admin → Câu thoại), giữ nguyên tinh thần đó: cảm ơn, rủ tương tác, đừng kêu gọi tặng quà.

## Chạy game

```bash
npm install
```

```bash
npm start
```

- Game: http://127.0.0.1:3939/game/ — thêm vào OBS / TikTok LIVE Studio dưới dạng **Browser Source**, kích thước **1080 × 1920** (dọc). Bật “Control audio via OBS” để tiếng Lão và tiếng chó sủa vào live.
- Admin: http://127.0.0.1:3939/admin/

**Chạy nhanh bằng double-click** (cần cài [Node.js](https://nodejs.org) 18 trở lên):

- **Windows:** mở `start.bat`.
- **macOS:** lần đầu mở Terminal trong thư mục game, chạy `chmod +x start.command`, sau đó double-click `start.command`. Nếu macOS chặn vì “không xác định được nhà phát triển”: chuột phải → Open → Open.

Cả hai sẽ tự `npm install` lần đầu, chạy máy chủ và mở trang Admin.

### Dùng trên Mac

TikFinity Desktop (WebSocket cổng 21213) chủ yếu dành cho Windows. Trên Mac chọn **một** trong các cách sau:

1. **Kết nối bằng username** (khuyên dùng): Admin → Tổng quan → nhập username. Không cần TikFinity.
2. **TikFinity bản web + Webhook:** trong TikFinity tạo Action Webhook gọi `http://127.0.0.1:3939/api/webhook?...` (xem mục Kết nối TikFinity). Endpoint đã bật CORS để gọi được từ trình duyệt.
3. **TikFinity Desktop trên một máy Windows khác:** đổi địa chỉ WebSocket ở Admin → Cài đặt thành `ws://<IP máy Windows>:21213/`.

OBS trên Mac: thêm Browser Source `http://127.0.0.1:3939/game/?master=1` như trên Windows.

Nếu mở game bằng Chrome thường, bấm vào trang một lần để bật âm thanh (trình duyệt chặn tự phát tiếng). OBS không cần.

**Mở nhiều màn hình game cùng lúc** (OBS + Chrome để xem thử…): chỉ **một** màn hình phát tiếng, các màn hình khác hiện “🔇 Màn hình phụ” và chỉ có phụ đề, nên giọng không bị chồng. Máy chủ ưu tiên màn hình có `?master=1`, rồi tới OBS / LIVE Studio, rồi màn hình mở sớm nhất. Đổi tay ở Admin → Tổng quan → “Phát tiếng ở đây”. Nên dùng địa chỉ này trong OBS:

```
http://127.0.0.1:3939/game/?master=1
```

Các tình tiết dùng chung **một sân khấu**: tình tiết sau chỉ bắt đầu khi tình tiết trước diễn xong (cách nhau vài giây). Bấm “▶ Chạy” trong Admin → **Tình tiết** khi đang bận thì tình tiết được xếp hàng (tối đa 5) và tự diễn sau.

## Kết nối bằng username (không cần TikFinity)

Admin → Tổng quan → ô **“Kết nối live TikTok bằng username”**: gõ `username` (hoặc dán link `tiktok.com/@username/live`) rồi bấm **Kết nối**. Username đã thêm được lưu thành danh sách để bấm chọn lại nhanh; × để xóa.

- Chưa lên live thì admin báo “Chưa lên live” và tự thử lại mỗi 30 giây; hết live cũng tự chờ buổi sau.
- Dùng thư viện không chính thức `tiktok-live-connector` (ký qua máy chủ Euler Stream). Gói miễn phí thường đủ dùng; nếu báo lỗi giới hạn, tạo API key ở eulerstream.com rồi dán vào Admin → Cài đặt.
- **Đừng bật cùng lúc** TikFinity và username cho cùng một buổi live, nếu không mỗi món quà bị tính 2 lần.

## Xu thật và xu seeding

Quà gửi từ Admin → Thử nghiệm (giả lập) được tính là **xu seeding**. Admin hiện riêng **Xu thật** (từ TikTok) và **Xu seeding**; bảng người tặng ghi `+ 🌱` phần seeding, nhật ký sự kiện gắn nhãn 🌱. Trên màn hình live, xu seeding **không** được cộng vào bảng xếp hạng và mục tiêu (người xem sẽ tưởng là quà thật — dễ bị coi là tương tác giả). Muốn hiện thì bật “Hiện xu seeding…” ở Admin → Cài đặt.

## Kết nối TikFinity

1. Mở **TikFinity desktop** (Windows; Mac xem mục “Dùng trên Mac”), kết nối với live TikTok của bạn.
2. Game tự kết nối WebSocket tới `ws://localhost:21213/` (đổi ở Admin → Cài đặt nếu khác).
3. Admin → Tổng quan hiện trạng thái: *Đã kết nối*, số tin nhắn, lỗi nếu có. Tích “Dữ liệu thô” để xem chính xác TikFinity gửi gì.

Cách khác: tạo Action **Webhook** trong TikFinity gọi `http://127.0.0.1:3939/api/webhook?type=gift&nickname={nickname}&gift={giftname}&count={repeatcount}&diamonds={coins}` (chỉ dùng một trong hai cách, nếu không quà sẽ bị tính hai lần).

## Người xem tương tác thế nào

| Người xem làm | Trong game |
|---|---|
| Tặng quà | Một người dân mang quà mừng hội làng tới (xu may mắn, khoai nướng, chuối, bánh chưng, gạo nếp), Lão cảm ơn **đọc tên** người tặng |
| Quà lớn (≥ 500 xu) | Banner, pháo giấy, cả làng reo |
| Đủ mốc xu thật (300 / 800 / 2.000 / 5.000 / 12.000) | Lên cấp mục tiêu hội làng (Thắp đèn lồng → Sân chơi cho Vàng → Sân khấu → Mở hội làng → Đón con trai Lão về ăn Tết) |
| Thả tim | Tim bay, Cậu Vàng vẫy đuôi; đủ mốc tim Lão cảm ơn |
| Nhiều tim (500/phút) hoặc nhiều quà (300 xu/phút) | **Cậu Vàng đứng dậy nhảy hiphop** |
| Bình luận “Vàng ơi” | Cậu Vàng sủa chào tên người đó |
| Bình luận “Lão ơi” | Lão trả lời |
| Follow / Share | Lão chào tên, cảm ơn |
| Vào live | Một người dân mang tên họ đi qua làng |

Thanh “vui” của Lão và Vàng tăng khi có bất kỳ tương tác nào (tim, bình luận, follow, quà), giảm chậm khi vắng và không bao giờ dùng để ép ai. Khi vắng, Lão kể chuyện, nói câu vui, rủ bình luận; Cậu Vàng ngủ gật.

## Tình tiết câu chuyện

Máy chủ tự diễn theo lịch (Admin → Cài đặt → Tình tiết), hoặc bấm tay ở Admin → **Tình tiết**. Điểm thử thách: tim = 1, bình luận = 5, follow / share = 10. **Quà không được tính.**

| Tình tiết | Cả làng làm | Đủ điểm | Chưa đủ điểm |
|---|---|---|---|
| 🎩 Quan huyện hỏi mua Cậu Vàng | Thả tim, bình luận, follow | Quan chịu thua, cả làng mừng | Vàng chẳng chịu theo ai, quan tự về |
| 🏮 Lý trưởng xét mở hội làng | Thả tim, bình luận, follow | Mở hội: pháo giấy, cả làng reo | Hẹn hội làng lần sau |
| 🥷 Binh Tư lảng vảng | Thả tim, bình luận “đuổi” | Cả làng hô, hắn chạy mất | Vàng tự sủa đuổi hắn |
| 👓 Ông Giáo | — | Giới thiệu làng, truyện Lão Hạc, cách chơi; trò chuyện với Lão | |
| 🧒 Trẻ con | — | Chạy đuổi nhau, gà chạy tán loạn | |
| 🤗 Trẻ con bế Cậu Vàng | — | Bế lên quay vòng rồi đặt xuống | |
| ⚽ Trẻ con chơi bóng | — | Ném bóng, Cậu Vàng chạy nhặt về | |
| 🐔 Cậu Vàng lùa gà | — | Chạy đuổi cả đàn gà quanh sân | |
| 🪢 Người xem thi kéo co | — | Hai người dân mang tên người xem vừa chat / thả tim thi kéo co, đám đông hò “Hò dô ta!”, Lão bắt tay làm lành | |
| 🌧️ Mưa rào | — | Trời tối, mưa, người dân chạy mưa / che đầu, Vàng rũ nước, rồi cầu vồng trên cổng làng | |
| 🪁 Thả diều | — | Một đứa trẻ thả diều bay qua làng, Lão kể chuyện hồi bé | |
| 🦋 Vàng đuổi bướm | — | Bướm bay quanh sân, Vàng đuổi mãi không bắt được | |

Thỉnh thoảng còn có: gà trống gáy, Cậu Vàng lăn ra nằm ngửa, Vàng ngáp.

## Khi có người tặng quà

Người tặng (đang đứng trong đám đông hoặc từ đường làng vào) bước lên tặng; **camera quay vào họ** cùng Lão và Cậu Vàng. Quà càng lớn càng xịn:

| Kim cương / lần tặng | Mang tới | Hành động |
|---|---|---|
| 1–4 | Xu may mắn | Cúi chào, nhún nhảy |
| 5–19 | Khoai nướng | Camera ~2 giây, nhảy một điệu, tim bay |
| 20–49 | Nải chuối | Camera ~3 giây, nhảy + đốt pháo, người đứng cạnh vẫy tay, Vàng sủa mừng |
| 50–99 | Bánh chưng | Camera ~3,5 giây + đèn sân khấu, pháo dài, Lão và cả đám đông reo |
| 100–499 | Bao gạo nếp | Camera ~4 giây + đèn sân khấu, pháo hoa, **Cậu Vàng đứng dậy nhảy hiphop cùng người tặng** |
| 500+ | Mâm cỗ hội làng | Pháo hoa, banner tên người tặng, rồi **cả làng mở hội** (camera lùi xa, mọi người cùng nhảy) |

Màn hình live chỉ ghi chung “🎁 Quà → hiệu ứng mừng hội làng”, không niêm yết giá.
Spotlight ngắn để nhường sóng: người tặng sau được quay sau khi người trước đã có ít nhất 1,5 giây.

## Cấp bậc dân làng

Mỗi người xem có điểm kinh nghiệm, lưu lại qua các buổi live (`data/viewers.json`). Cấp lên nhờ **tương tác hoặc quà**, nên ai cũng lên được:

| Hành động | Kinh nghiệm |
|---|---|
| Vào live | +3 (tối đa 1 lần / 30 phút) |
| Bình luận | +2 (tối đa 1 lần / 15 giây) |
| Mỗi 10 tim | +1 |
| Follow | +25 (1 lần) |
| Chia sẻ | +15 |
| Hội viên | +50 |
| Quà | +3 mỗi kim cương |
| **Thắng sự kiện lớn** | +30 cho mỗi người trong đội thắng (đèn trời thành công: +15 cho mọi người góp) |

Cấp: Khách qua đường (0) → **Dân làng (10)** → Trưởng xóm (50) → Hương sư (180) → Chánh hội (500) → Tiên chỉ (1500). Ngưỡng và tên đổi ở Cài đặt.
Cấp càng cao áo càng xịn (khăn, đai vàng, áo choàng, vương miện) và được đứng chỗ gần Lão hơn; lên cấp có spotlight riêng (lên cấp hàng loạt nhờ thắng sự kiện thì chỉ có pháo nhỏ, vì cả đội vừa được vinh danh).

### Bảng "Bạn của làng" (góc trái)

Tự xoay vòng 4 trang:
1. **Bạn của làng**: 5 người vừa tương tác (cấp + việc vừa làm: ghé làng, bình luận, thả tim, follow…). Không hiện số kim cương.
2. **⭐ Top kinh nghiệm**: 5 người nhiều kinh nghiệm nhất (cấp, danh hiệu, điểm). Tài khoản seeding / thử nghiệm không bao giờ hiện ở đây.
3. **🏯 Các cấp dân làng**: danh sách cấp, biểu tượng, điểm cần có (và danh hiệu Địa chủ).
4. **🌾 Làm Dân làng**: cách lên cấp, chỉ liệt kê cách **miễn phí** (vào live, bình luận, tim, follow, chia sẻ, thắng sự kiện).

## Địa chủ của làng

Người tặng nhiều nhất **trong buổi live này** (tối thiểu 30 kim cương thật; seeding không bao giờ tính) được làm **🏯 Địa chủ** khi đang có mặt trong làng:
- chỗ đứng riêng cạnh Lão (chiếu đỏ viền vàng, ghế gỗ), áo choàng đỏ;
- một lính **che lọng** và một lính **quạt** đi theo mọi nơi;
- lần đầu nhận danh hiệu có spotlight + Lão chào.

Khi người khác tặng nhiều hơn, danh hiệu chuyển sang họ; người cũ về chỗ theo cấp của mình. Rời live (không tương tác quá lâu) thì lính hầu đi theo, quay lại thì được đón tiếp. Không hiện số kim cương, không có câu kêu gọi tặng để giành danh hiệu. Tắt / chỉnh mức tối thiểu ở Cài đặt → Địa chủ của làng.

## Ông Giáo đố chữ

Mỗi ~4 phút (hoặc bấm ở tab Tình tiết), Ông Giáo ra một từ / cụm từ 6–20 chữ cái, các chữ bị **xáo trộn**. Người xem gõ đáp án vào bình luận (không dấu cũng được).
- Gõ sai: Ông Giáo nhắc tên, trêu vui ("Sai rồi … ơi! Về ôn lại chữ đi con!"); gần đúng thì động viên.
- Càng lâu càng hé thêm chữ gợi ý.
- **Người đúng nhanh nhất**: banner tên + đáp án + số giây, bảng "🎓 Trạng nguyên đố chữ", bước lên giữa làng có spotlight, +20 kinh nghiệm.
- Đáp án chỉ nằm trên máy chủ cho tới khi có người giải, nên không ai xem trộm được.
- Bộ từ, thời gian, kinh nghiệm thưởng: Cài đặt → Ông Giáo đố chữ. Câu thoại: tab Câu thoại.

## Minigame và cảnh vui

- **Ông Giáo đố**: mỗi lần chọn ngẫu nhiên 1 trong 3 kiểu: đố chữ (xếp chữ), đố vui (câu đố dân gian, đọc to câu hỏi), toán nhanh (cộng, trừ, nhân, 25 giây). Ai gõ đúng nhanh nhất được vinh danh + kinh nghiệm. Bật/tắt từng kiểu và sửa bộ câu đố trong Cài đặt (config: quiz.modes, quiz.riddles).
- **Ông Giáo đọc thơ**: đọc ca dao (dân gian, không bản quyền) hiện trên cuộn giấy, rồi gọi tên khen 2–3 người vừa bình luận (có spotlight).
- **Hàng xóm cãi nhau**: hai dân làng lăn vào đám mây bụi hoạt hình; người xem gõ "can" (cần 3 người) để can, rồi bắt tay làm lành. Admin có thể chọn 2 người xem để "đấu vui" (thẻ 🥊 trong tab Tình tiết).
- **Cậu Vàng nhào lộn**: trẻ con sút bóng lên cao, Vàng lộn một vòng trên không đớp bóng (thay cho cảnh sút chó, vì cảnh ngược đãi con vật dễ vi phạm chính sách).
- **Lão Hạc** lúc rảnh nhấp bát nước chè bốc khói hoặc phe phẩy quạt mo (thay cho điếu cày: cảnh hút thuốc dễ bị hạn chế hiển thị).

## Chat trên sóng

- Chat của người xem chỉ hiện **bong bóng trên đầu nhân vật** của họ, không đọc bằng giọng. Lão / Ông Giáo đáp chat cũng bằng bong bóng chữ.
- Làng đông (từ 10 người) thì camera tự nâng cao, nhìn chéo xuống đám đông.
- Ưu tiên vào làng: quà > chat > follow/chia sẻ > tim > chỉ vào xem; khi rất đông, ai đứng hơn 90 giây nhường chỗ cho người chat mới.
- Admin → Tổng quan hiện số chat / quà / tim 5 phút qua theo nguồn; nếu không có chat nào mà vẫn có tương tác khác sẽ báo đỏ (thường do TikFinity chưa bấm Connect vào live).
- Sự kiện đến từ cả TikFinity và kết nối username chỉ tính 1 lần.

## Sự kiện lớn (theo nhóm)

Tự bắt đầu khi live đủ sôi nổi (điểm tim 1, bình luận 3, follow 10 trong khoảng thời gian cài đặt), hoặc bấm chạy ở tab Tình tiết:

- 🪢 **Kéo co**: Xóm Đông vs Xóm Tây (gõ Đông/Tây hoặc 1/2). Người xem trong đám đông xếp hàng kéo thật.
- 🚣 **Đua thuyền**: 4 thuyền Đỏ/Vàng/Xanh/Tím (1–4). Camera ra sông, Lão bình luận ở khung dưới.
- 🏮 **Thả đèn trời**: cả làng góp chung; đèn mang tên người góp bay lên.
- 🙈 **Bịt mắt đập niêu**: một người xem bị bịt mắt, cả live gõ trái/phải/lên/xuống/đập để chỉ đường.

Chỉ tính tim, bình luận, follow, chia sẻ. Quà **không** tính điểm phe (có thể bật kiểu PK ở Cài đặt).
Kết thúc: **Bảng vàng** hiện tên cả đội thắng, những người đang trong đám đông bước lên hai bên Lão nhảy mừng, Lão đọc tên, rồi cả đội được thưởng kinh nghiệm.

## Làng sống động

- Dân làng hài hước đi qua và đứng xem: tóc moi, tóc một bím, áo vá, quần rách một ống, nhe răng.
- Thỉnh thoảng có người **dắt trâu** (có thừng), **ôm heo** (heo con chạy theo), **chăn vịt** (đàn vịt lạch bạch đi trước). Cậu Vàng sủa trêu.
- Cài đặt → “Tốc độ đi” (mặc định 1,35) và bật/tắt, tỉ lệ người dắt con vật.

## Chính sách TikTok LIVE — đã rà soát

**Kiểm duyệt lại sau khi live bị hạn chế (Integrity & Authenticity, 8/11/2026):**
- Không thưởng gì cho follow / chia sẻ / hội viên (không kinh nghiệm, không điểm thử thách hay điểm phe); không câu nào hứa "follow để được gọi tên".
- Thử thách thất bại không có hậu quả: không bắt chó, không khóc lóc, không câu kiểu "nếu thương thì thả tim". Khách chỉ về.
- Không còn cái bát xin ăn: quà rơi vào mâm hội làng; tên mốc quà đều là việc vui của làng (không có "đón con trai về").
- Không chế giễu người xem có tên: câu trêu khi đoán sai / thua kéo co đều nhẹ nhàng.
- Lọc emoji thô tục (🖕 🍆 🍑 💦 🔞 🤬 💩) khỏi tên và chat.
- Nhãn "🤖 Giọng nhân vật do AI đọc" ở góc màn hình.
- Chống spam điểm; giả lập hỏi xác nhận khi đang live; seeding không bao giờ hiện như thật.
- Nên có người dẫn thật (mic), chỉ dùng một kết nối (TikFinity), không bật tắt live liên tục.

**Bảng xếp hạng, hướng dẫn lên cấp, đố chữ (rà soát thêm):**
- Bảng "Bạn của làng" và Top kinh nghiệm không hiện số kim cương hay giá trị quà; quà chỉ ghi "mừng hội làng".
- Hướng dẫn lên cấp chỉ nêu cách miễn phí, ghi rõ "Miễn phí, ai cũng lên được"; không có câu nào kêu gọi tặng quà để lên cấp.
- Top kinh nghiệm loại tài khoản seeding (không làm người xem hiểu sai).
- Đố chữ chỉ cần bình luận; quà không giúp thắng. Câu nhắc khi sai là trêu nhẹ, không xúc phạm; sửa được ở tab Câu thoại.
- Địa chủ: danh hiệu cảm ơn người tặng nhiều nhất (giống huy hiệu top gifter của TikTok), không hiện số tiền, không thông báo kiểu "bị cướp ngôi" hay kêu gọi tặng để giành; seeding không tính.
- Muốn an toàn tối đa: đặt "kinh nghiệm mỗi kim cương" = 0, để cấp bậc hoàn toàn đến từ tương tác.

Đã làm để giảm rủi ro:
- Không xin quà, không đe dọa, không có hậu quả xấu gắn với việc **không tặng quà**. Thử thách chỉ tính tim / bình luận / follow (quà không tính).
- Không hình ảnh ăn xin người già yếu thế; mục tiêu là “hội làng” (rõ ràng hư cấu), không phải quyên góp thật.
- Không bạo lực với động vật (đã bỏ sút chó, dọa bả); Cậu Vàng bị dắt đi thì luôn tự vùng về.
- Không cho người xem “đánh nhau” bằng tên thật (đã đổi thành kéo co) — tránh bị coi là bắt nạt / quấy rối.
- Quà giả lập (seeding) **không** vào bảng xếp hạng / mục tiêu công khai và được gắn nhãn “🧪 thử” trên live.
- Bộ lọc từ tục cho tên và bình luận hiện trong bong bóng / đọc to (Admin → Cài đặt → Từ cấm).
- Không niêm yết “bao nhiêu kim cương thì được gì” trên màn hình live.

Còn lại do bạn quyết định / theo dõi:
- Hiệu ứng to hơn cho quà lớn là kiểu game tương tác phổ biến, nhưng TikTok có thể đổi luật; đừng nói những câu kiểu “tặng X để…”.
- Thử thách thua thì Cậu Vàng bị dắt đi một lúc: không gắn với quà, nhưng vẫn là “áp lực tương tác” nhẹ — tắt ở Admin → Tình tiết nếu muốn an toàn tối đa.
- Bật “Đọc bình luận” nghĩa là giọng AI đọc nội dung người xem gõ — chỉ lọc được các từ trong danh sách.
- Tự kiểm tra lại quy định LIVE mới nhất trong app TikTok trước khi lên sóng.



Lần đầu chạy bản này, `data/config.json` tự chuyển sang bộ câu thoại / tình tiết / mục tiêu mới; bản cũ được lưu ở `data/config.backup-v1.json`.

## Giọng AI

Admin → Cài đặt → Giọng AI:

- **Google** — miễn phí, không cần key (giọng nữ, game phát chậm lại cho trầm hơn). Đây là API không chính thức, có thể bị giới hạn.
- **FPT.AI** — giọng Việt, có giọng nam miền Bắc `leminh`, hợp với Lão Hạc. Cần API key từ fpt.ai.
- **ElevenLabs** / **OpenAI** — chất lượng cao, OpenAI có ô “Chỉ dẫn giọng” để nói giọng ông lão. Cần API key.

Nếu nhà cung cấp lỗi, máy chủ tự dùng Google dự phòng; nếu cả hai lỗi, game dùng giọng của trình duyệt. API key chỉ lưu trong `data/config.json` trên máy bạn.

Tab **Câu thoại** cho sửa mọi câu Lão nói (`{name}`, `{gift}`, `{count}`, `{item}`, `{goal}`).

## Dựng lại mô hình 3D (Blender)

Mọi mô hình được dựng bằng script Python trong `blender/`, xuất ra `public/models/*.glb`:

```bash
npm run build:models
```

- `blender/characters.py` — Lão Hạc (ngồi, có khớp đầu / tay / râu / lưng), Cậu Vàng (đầu, hàm, đuôi), 10 kiểu người dân + quan, lính, lý trưởng, Binh Tư, ông Giáo, người dắt trâu / ôm heo / chăn vịt; trâu, heo, vịt, gà (chân tay cử động được)
- `blender/environment.py` — cổng làng, tre, nhà tranh, nhà ngói, cây đa, giếng, đống rơm, hàng rào, đồ vật, quà tặng
- Script tự tìm Blender: biến môi trường `BLENDER` → `D:/Blender 5.2/blender.exe` / `Program FilesBlender Foundation` (Windows) → `/Applications/Blender.app` (macOS) → `blender` trong PATH. Ví dụ trên Mac: `BLENDER=/Applications/Blender.app/Contents/MacOS/Blender npm run build:models`

## Cấu trúc

```
server/        Node: TikFinity, thống kê, giọng AI, API admin, WebSocket
public/game/   Three.js: cảnh làng, nhân vật, phản ứng sự kiện, âm thanh
public/admin/  Trang quản trị
blender/       Script dựng mô hình
data/          config.json, stats.json (tự tạo)
```

Biến môi trường: `PORT` (mặc định 3939), `HOST` (mặc định 127.0.0.1 — chỉ máy này truy cập được).
