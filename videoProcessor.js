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
 * Create m3u8 with low quality first segment for fast start
 * @param {string} videoPath - Path to the video file
 * @param {number} segmentDuration - Duration of each segment in seconds
 * @param {string} outputDir - Output directory for the m3u8 files
 */
function createM3U8WithFastStart(videoPath, segmentDuration, outputDir) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create output directory if it doesn't exist
      if (!fsSync.existsSync(outputDir)) {
        fsSync.mkdirSync(outputDir, { recursive: true });
      }

      const playlistPath = path.join(outputDir, 'playlist.m3u8');
      const lowQualitySegment = path.join(outputDir, 'segment000.ts');
      const segmentPattern = path.join(outputDir, 'segment%03d.ts');

      console.log(`Creating m3u8 with FAST START (low quality first segment) - ${segmentDuration}s segments for ${path.basename(videoPath)}...`);

      // Step 1: Create low quality first segment (максимально уродское качество)
      console.log('Creating ultra-low quality first segment...');
      await new Promise((resolveSegment, rejectSegment) => {
        ffmpeg(videoPath)
          .outputOptions([
            '-t ' + segmentDuration,              // Only first segment duration
            '-c:v libx264',                       // Video codec
            '-preset ultrafast',                  // Fastest encoding
            '-crf 51',                            // Worst quality (0-51, 51 is worst)
            '-vf scale=160:90',                   // Tiny resolution (160x90)
            '-r 10',                              // Low framerate (10 fps)
            '-b:v 50k',                           // Ultra low video bitrate (50 kbps)
            '-maxrate 50k',
            '-bufsize 100k',
            '-c:a aac',                           // Audio codec
            '-b:a 32k',                           // Ultra low audio bitrate (32 kbps)
            '-ar 22050',                          // Low sample rate
            '-ac 1',                              // Mono audio
            '-f mpegts'                           // MPEG-TS format
          ])
          .output(lowQualitySegment)
          .on('start', (commandLine) => {
            console.log(`FFmpeg low-quality command: ${commandLine}`);
          })
          .on('end', () => {
            console.log('✓ Ultra-low quality first segment created');
            resolveSegment();
          })
          .on('error', (err, stdout, stderr) => {
            console.error('Error creating low quality segment:', err.message);
            rejectSegment(err);
          })
          .run();
      });

      // Step 2: Create remaining segments with normal quality (copy codec)
      console.log('Creating normal quality segments (starting from second segment)...');
      await new Promise((resolveRest, rejectRest) => {
        ffmpeg(videoPath)
          .outputOptions([
            '-ss ' + segmentDuration,             // Skip first segment duration
            '-codec: copy',                       // Copy codecs without re-encoding
            '-start_number 1',                    // Start from segment 1
            '-hls_time ' + segmentDuration,       // Segment duration
            '-hls_list_size 0',                   // Keep all segments in playlist
            '-f hls',                             // Output format HLS
            '-hls_segment_filename ' + segmentPattern // Segment file pattern
          ])
          .output(playlistPath)
          .on('start', (commandLine) => {
            console.log(`FFmpeg normal segments command: ${commandLine}`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              process.stdout.write(`\rProgress: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            console.log('\n✓ Normal quality segments created');
            resolveRest();
          })
          .on('error', (err, stdout, stderr) => {
            console.error('Error creating normal segments:', err.message);
            rejectRest(err);
          })
          .run();
      });

      // Step 3: Manually create playlist with low quality first segment
      console.log('Creating custom playlist...');
      const playlistContent = fsSync.readFileSync(playlistPath, 'utf8');
      
      // Parse existing playlist and add first segment
      const lines = playlistContent.split('\n');
      const newPlaylist = [];
      
      // Add header
      newPlaylist.push('#EXTM3U');
      newPlaylist.push('#EXT-X-VERSION:3');
      newPlaylist.push('#EXT-X-TARGETDURATION:' + Math.ceil(segmentDuration));
      newPlaylist.push('#EXT-X-MEDIA-SEQUENCE:0');
      
      // Add low quality first segment
      newPlaylist.push('#EXTINF:' + segmentDuration.toFixed(6) + ',');
      newPlaylist.push('segment000.ts');
      
      // Add remaining segments from generated playlist
      let addSegments = false;
      for (const line of lines) {
        if (line.startsWith('#EXTINF:')) {
          addSegments = true;
        }
        if (addSegments && (line.startsWith('#EXTINF:') || line.startsWith('segment'))) {
          newPlaylist.push(line);
        }
      }
      
      newPlaylist.push('#EXT-X-ENDLIST');
      
      // Write custom playlist
      fsSync.writeFileSync(playlistPath, newPlaylist.join('\n'));
      
      console.log(`✓ Finished creating m3u8 with FAST START (${segmentDuration}s segments)`);
      resolve(playlistPath);
    } catch (error) {
      console.error('Error in createM3U8WithFastStart:', error);
      reject(error);
    }
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
    { duration: 0.5, suffix: '500ms', fastStart: false },
    { duration: 0.5, suffix: '500ms_fast', fastStart: true },
    { duration: 1, suffix: '1s', fastStart: false },
    { duration: 1, suffix: '1s_fast', fastStart: true },
    { duration: 4, suffix: '4s', fastStart: false },
    { duration: 4, suffix: '4s_fast', fastStart: true },
    { duration: 8, suffix: '8s', fastStart: false },
    { duration: 8, suffix: '8s_fast', fastStart: true },
    { duration: 12, suffix: '12s', fastStart: false },
    { duration: 12, suffix: '12s_fast', fastStart: true }
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
        if (variant.fastStart) {
          await createM3U8WithFastStart(videoPath, variant.duration, outputDir);
        } else {
          await createM3U8(videoPath, variant.duration, outputDir);
        }
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
  createM3U8,
  createM3U8WithFastStart
};

