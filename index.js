const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { processVideosOnStartup } = require('./videoProcessor');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory (HTML player)
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from uploads directory
app.use('/videos', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.get('/api/videos', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ videos: [] });
    }

    const files = fs.readdirSync(uploadsDir);
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext);
    });

    const videos = videoFiles.map(file => {
      const baseName = path.parse(file).name;
      return {
        name: file,
        baseName: baseName,
        original: `/videos/${file}`,
        hls_500ms: `/videos/${baseName}_500ms/playlist.m3u8`,
        hls_1s: `/videos/${baseName}_1s/playlist.m3u8`,
        hls_4s: `/videos/${baseName}_4s/playlist.m3u8`,
        hls_8s: `/videos/${baseName}_8s/playlist.m3u8`,
        hls_12s: `/videos/${baseName}_12s/playlist.m3u8`
      };
    });

    res.json({ videos });
  } catch (error) {
    console.error('Error listing videos:', error);
    res.status(500).json({ error: 'Failed to list videos' });
  }
});

// Get specific video info
app.get('/api/videos/:videoName', (req, res) => {
  try {
    const videoName = req.params.videoName;
    const uploadsDir = path.join(__dirname, 'uploads');
    const videoPath = path.join(uploadsDir, videoName);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const baseName = path.parse(videoName).name;
    const video = {
      name: videoName,
      baseName: baseName,
      original: `/videos/${videoName}`,
      hls_500ms: `/videos/${baseName}_500ms/playlist.m3u8`,
      hls_1s: `/videos/${baseName}_1s/playlist.m3u8`,
      hls_4s: `/videos/${baseName}_4s/playlist.m3u8`,
      hls_8s: `/videos/${baseName}_8s/playlist.m3u8`,
      hls_12s: `/videos/${baseName}_12s/playlist.m3u8`
    };

    res.json({ video });
  } catch (error) {
    console.error('Error getting video info:', error);
    res.status(500).json({ error: 'Failed to get video info' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Video streaming API is running' });
});

// Start server
async function startServer() {
  try {
    console.log('Starting video streaming server...');
    
    // Process existing videos on startup
    await processVideosOnStartup();
    
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`\n🎬 Open in browser: http://localhost:${PORT}`);
      console.log(`\nAPI endpoints:`);
      console.log(`  - GET / - Video player interface`);
      console.log(`  - GET /health - Health check`);
      console.log(`  - GET /api/videos - List all videos`);
      console.log(`  - GET /api/videos/:videoName - Get specific video info`);
      console.log(`  - GET /videos/* - Stream video files`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

