const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Thêm Header cho phép App IPTV truy cập không bị chặn CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Endpoint chính cho App IPTV của bạn gọi vào
app.get('/api/iptv-movies', async (req, res) => {
    try {
        // 1. Gọi lấy danh sách phim mới nhất từ NguonC (Trang 1)
        const nguonCResponse = await axios.get('https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=1');
        const movies = nguonCResponse.data.items || [];

        // 2. Tạo khung JSON chuẩn theo cấu trúc App IPTV của bạn
        let iptvConfig = {
            "id": "NguonCPhimLive",
            "name": "NguonC - Hội Quán Click",
            "color": "#E50914",
            "org_metadata": {
                "image": "https://phim.nguonc.com/public/images/Logo/logonc.png",
                "title": "Hệ thống phim NguonC Realtime",
                "description": "Dữ liệu cập nhật thời gian thực từ API NguonC."
            },
            "description": "Kênh tổng hợp phim tự động, 100% không thu phí.",
            "url": "https://toiyeuvietnam.dpdns.org/v1",
            "image": {
                "display": "contain",
                "shape": "square",
                "url": "https://phim.nguonc.com/public/images/Logo/logonc.png",
                "height": 101,
                "width": 155
            },
            "grid_number": 1,
            "groups": []
        };

        let movieGroup = {
            "id": "phim-moi",
            "name": "Phim Mới Cập Nhật",
            "display": "slider",
            "grid_columns": null,
            "remote_data": { "enable": false, "url": "" },
            "enable_detail": true,
            "channels": []
        };

        // 3. Duyệt qua danh sách phim để lấy thông tin chi tiết (Tập phim & Link m3u8)
        // Dùng Promise.all để gọi đồng thời nhiều phim giúp tối ưu tốc độ xử lý
        const detailPromises = movies.map(movie => 
            axios.get(`https://phim.nguonc.com/api/film/${movie.slug}`).catch(() => null)
        );
        
        const detailResponses = await Promise.all(detailPromises);

        detailResponses.forEach((detailRes, index) => {
            if (!detailRes || !detailRes.data || !detailRes.data.movie) return;
            
            const movieDetail = detailRes.data.movie;
            const episodesData = movieDetail.episodes || [];
            let sourcesList = [];

            // Duyệt qua các Server phim (Vietsub, Thuyết minh...)
            episodesData.forEach(server => {
                let contentsList = [];
                const serverItems = server.items || [];

                serverItems.forEach(ep => {
                    // Định dạng cấu trúc stream của bạn
                    contentsList.append({
                        "id": `content-${movieDetail.slug}-${ep.slug}`,
                        "name": ep.name,
                        "streams": [{
                            "id": `stream-${movieDetail.slug}-${ep.slug}`,
                            "name": ep.name,
                            "image": {
                                "display": "contain",
                                "shape": "square",
                                "url": movieDetail.thumb_url,
                                "height": 101,
                                "width": 155
                            },
                            "stream_links": [{
                                "id": `link-${movieDetail.slug}-${ep.slug}`,
                                "name": ep.name,
                                "url": ep.m3u8 || ep.embed, // Lấy link trực tiếp phát m3u8
                                "type": "hls",
                                "default": true
                            }],
                            "remote_data": null
                        }]
                    });
                });

                sourcesList.push({
                    "id": `source-${server.server_slug}`,
                    "name": server.server_name,
                    "contents": contentsList
                });
            });

            // Đóng gói phim thành một "channel" theo định dạng của bạn
            movieGroup.channels.push({
                "id": movieDetail.id || movieDetail.slug,
                "name": movieDetail.name,
                "image": {
                    "display": "cover",
                    "shape": "square", // Bạn có thể sửa thành "vertical" nếu app hỗ trợ dọc
                    "url": movieDetail.thumb_url,
                    "height": 101,
                    "width": 155
                },
                "type": "single",
                "display": "text-below",
                "sources": sourcesList
            });
        });

        iptvConfig.groups.push(movieGroup);

        // 4. Trả về kết quả JSON đã được định dạng chuẩn hóa
        res.json(iptvConfig);

    } catch (error) {
        console.error("Lỗi xử lý API:", error.message);
        res.status(500).json({ error: "Lỗi kết nối hệ thống nguồn" });
    }
});

app.listen(PORT, () => {
    console.log(`Server trung gian đang chạy tại cổng: ${PORT}`);
});
