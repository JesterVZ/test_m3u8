const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

/**
 * Process a video file and create m3u8 playlists with different segment durations
 * @param {string} videoPath - Path to the video file
 * @param {number} segmentDuration - Duration of each segment in seconds
 * @param {string} outputDir - Output directory for the m3u8 files
 */
function createM3U8(videoPath, segmentDuration, outputDir) {
  return new Promise((resolve, reject) => {
    // Create output directory if it doesn't exist
    if (!fsSync.existsSync(outputDir)) {
      fsSync.mkdirSync(outputDir, { recursive: true });
    }

    const playlistPath = path.join(outputDir, 'playlist.m3u8');
    const segmentPattern = path.join(outputDir, 'segment%03d.ts');

    console.log(`Creating m3u8 with ${segmentDuration}s segments for ${path.basename(videoPath)}...`);

    ffmpeg(videoPath)
      .outputOptions([
        '-codec: copy',                          // Copy codecs without re-encoding
        '-start_number 0',                       // Start segment numbering from 0
        '-hls_time ' + segmentDuration,          // Segment duration
        '-hls_list_size 0',                      // Keep all segments in playlist
        '-f hls',                                // Output format HLS
        '-hls_segment_filename ' + segmentPattern // Segment file pattern
      ])
      .output(playlistPath)
      .on('start', (commandLine) => {
        console.log(`FFmpeg command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\rProgress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log(`\nFinished creating m3u8 with ${segmentDuration}s segments`);
        resolve(playlistPath);
      })
      .on('error', (err, stdout, stderr) => {
        console.error(`\nError creating m3u8: ${err.message}`);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .run();
  });
}

/**
 * Process a single video file and create all m3u8 variants
 * @param {string} videoPath - Path to the video file
 * @param {string} uploadsDir - Base uploads directory
 */
async function processVideo(videoPath, uploadsDir) {
  const videoName = path.basename(videoPath);
  const baseName = path.parse(videoName).name;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing video: ${videoName}`);
  console.log('='.repeat(60));

  // Define all segment durations to create
  const segmentVariants = [
    { duration: 0.5, suffix: '500ms' },
    { duration: 1, suffix: '1s' },
    { duration: 4, suffix: '4s' },
    { duration: 8, suffix: '8s' },
    { duration: 12, suffix: '12s' }
  ];

  try {
    let allExist = true;

    // Check if all variants already exist
    for (const variant of segmentVariants) {
      const outputDir = path.join(uploadsDir, `${baseName}_${variant.suffix}`);
      const playlistPath = path.join(outputDir, 'playlist.m3u8');
      if (!fsSync.existsSync(playlistPath)) {
        allExist = false;
        break;
      }
    }

    if (allExist) {
      console.log(`Video ${videoName} already processed (all variants exist). Skipping...`);
      return;
    }

    // Create m3u8 variants for each segment duration
    for (const variant of segmentVariants) {
      const outputDir = path.join(uploadsDir, `${baseName}_${variant.suffix}`);
      const playlistPath = path.join(outputDir, 'playlist.m3u8');

      if (!fsSync.existsSync(playlistPath)) {
        await createM3U8(videoPath, variant.duration, outputDir);
      } else {
        console.log(`${variant.suffix} variant already exists, skipping...`);
      }
    }

    console.log(`✓ Successfully processed ${videoName}`);
  } catch (error) {
    console.error(`✗ Failed to process ${videoName}:`, error.message);
    throw error;
  }
}

/**
 * Process all videos in the uploads directory on server startup
 */
async function processVideosOnStartup() {
  const uploadsDir = path.join(__dirname, 'uploads');

  console.log('\n' + '='.repeat(60));
  console.log('Checking uploads directory for videos...');
  console.log('='.repeat(60));

  try {
    // Create uploads directory if it doesn't exist
    if (!fsSync.existsSync(uploadsDir)) {
      await fs.mkdir(uploadsDir, { recursive: true });
      console.log('Created uploads directory');
      console.log('No videos found to process.');
      return;
    }

    // Read directory contents
    const files = await fs.readdir(uploadsDir);
    
    // Filter video files
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      const fullPath = path.join(uploadsDir, file);
      const isFile = fsSync.statSync(fullPath).isFile();
      return isFile && videoExtensions.includes(ext);
    });

    if (videoFiles.length === 0) {
      console.log('No videos found in uploads directory.');
      return;
    }

    console.log(`Found ${videoFiles.length} video(s) to process:`);
    videoFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });

    // Process each video
    for (const videoFile of videoFiles) {
      const videoPath = path.join(uploadsDir, videoFile);
      await processVideo(videoPath, uploadsDir);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ All videos processed successfully!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('Error processing videos:', error);
    throw error;
  }
}

module.exports = {
  processVideosOnStartup,
  processVideo,
  createM3U8
};

