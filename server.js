const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Chỉnh lại trang chủ để hiển thị thẳng list M3U luôn
app.get('/', async (req, res) => {
    try {
        // 1. Gọi lấy danh sách phim mới nhất từ NguonC
        const nguonCResponse = await axios.get('https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=1');
        const movies = nguonCResponse.data.items || [];

        // Khởi tạo dòng đầu tiên bắt buộc của một file playlist M3U
        let m3uPlaylist = "#EXTM3U\n";

        // 2. Gọi đồng thời chi tiết các bộ phim để lấy tập phim và link stream
        const detailPromises = movies.map(movie => 
            axios.get(`https://phim.nguonc.com/api/film/${movie.slug}`).catch(() => null)
        );
        
        const detailResponses = await Promise.all(detailPromises);

        // 3. Tiến hành bóc tách dữ liệu và nối chuỗi theo định dạng M3U IPTV
        detailResponses.forEach((detailRes) => {
            if (!detailRes || !detailRes.data || !detailRes.data.movie) return;
            
            const movieDetail = detailRes.data.movie;
            const episodesData = movieDetail.episodes || [];

            // Duyệt qua từng server phim (Vietsub, Thuyết minh...)
            episodesData.forEach(server => {
                const serverItems = server.items || [];

                // Duyệt qua từng tập phim
                serverItems.forEach(ep => {
                    const streamUrl = ep.m3u8 || ep.embed;
                    
                    // Tạo ID không dấu và không khoảng cách cho thuộc tính tvg-id
                    const tvgId = `${movieDetail.slug}-${ep.slug}`;
                    // Nhóm kênh mặc định cho phim
                    const groupTitle = "Phim Mới Cập Nhật";
                    // Tên hiển thị kết hợp Tên phim + Tập + Server phát
                    const displayName = `${movieDetail.name} - ${ep.name} (${server.server_name})`;

                    // Khởi tạo dòng #EXTINF theo chuẩn yêu cầu của bạn
                    m3uPlaylist += `#EXTINF:-1 tvg-id="${tvgId}" group-title="${groupTitle}" tvg-logo="${movieDetail.thumb_url}", ${displayName}\n`;
                    
                    // Thêm dòng User-Agent giả lập trình duyệt nếu cần (giúp luồng phát mượt mà, tránh bị chặn)
                    m3uPlaylist += `#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`;
                    
                    // Thêm link stream của tập phim
                    m3uPlaylist += `${streamUrl}\n`;
                });
            });
        });

        // 4. Thiết lập Header trả về định dạng text/plain thay vì JSON
        res.type('text/plain; charset=utf-8');
        res.send(m3uPlaylist);

    } catch (error) {
        console.error("Lỗi xử lý API:", error.message);
        res.status(500).send("#EXTM3U\n#Lỗi kết nối hệ thống nguồn phim");
    }
});

app.listen(PORT, () => {
    console.log(`Server IPTV M3U đang chạy tại cổng: ${PORT}`);
});
