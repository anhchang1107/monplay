const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/', async (req, res) => {
    try {
        // 1. Gọi lấy danh sách phim mới nhất từ NguonC
        const nguonCResponse = await axios.get('https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=1');
        const movies = nguonCResponse.data.items || [];

        // Mảng trống để chứa danh sách phim theo định dạng phẳng mới của bạn
        let flatIptvList = [];

        // 2. Gọi đồng thời chi tiết các bộ phim để lấy tập phim và link m3u8
        const detailPromises = movies.map(movie => 
            axios.get(`https://phim.nguonc.com/api/film/${movie.slug}`).catch(() => null)
        );
        
        const detailResponses = await Promise.all(detailPromises);

        // 3. Bóc tách và chuyển đổi cấu trúc dữ liệu
        detailResponses.forEach((detailRes) => {
            if (!detailRes || !detailRes.data || !detailRes.data.movie) return;
            
            const movieDetail = detailRes.data.movie;
            const episodesData = movieDetail.episodes || [];

            // Duyệt qua từng server phim (Vietsub, Thuyết minh...)
            episodesData.forEach(server => {
                const serverItems = server.items || [];

                // Duyệt qua từng tập phim
                serverItems.forEach(ep => {
                    // Tạo Object theo đúng form bạn yêu cầu và push vào mảng chính
                    flatIptvList.push({
                        "name": `${movieDetail.name} - ${ep.name} (${server.server_name})`, // Kết hợp Tên phim + Tập + Server
                        "logo": movieDetail.thumb_url,                                      // URL ảnh đại diện phim
                        "category": "Phim Mới Cập Nhật",                                   // Thể loại / Nhóm
                        "stream_url": ep.m3u8 || ep.embed                                  // URL luồng phát video m3u8
                    });
                });
            });
        });

        // 4. Trả về mảng JSON phẳng hoàn chỉnh
        res.json(flatIptvList);

    } catch (error) {
        console.error("Lỗi xử lý API:", error.message);
        res.status(500).json({ error: "Lỗi kết nối hệ thống nguồn" });
    }
});

app.listen(PORT, () => {
    console.log(`Server IPTV định dạng phẳng đang chạy tại cổng: ${PORT}`);
});
