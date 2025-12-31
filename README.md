# Video Streaming API (m3u8)

Node.js API для стриминга видео с использованием формата m3u8 (HLS).

## Возможности

- Автоматическая обработка видео при запуске сервера
- Создание двух вариантов m3u8 плейлистов:
  - С сегментами по 4 секунды
  - С сегментами по 1 секунде
- REST API для получения списка видео
- Стриминг видео через HTTP

## Требования

- Node.js (v14 или выше)
- FFmpeg (должен быть установлен в системе)

### Установка FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Скачайте с официального сайта: https://ffmpeg.org/download.html

## Установка

1. Клонируйте репозиторий или скопируйте файлы
2. Установите зависимости:

```bash
npm install
```

## Использование

### Запуск сервера

```bash
npm start
```

Для разработки с автоматической перезагрузкой:

```bash
npm run dev
```

Сервер запустится на `http://localhost:3000`

### Добавление видео

1. Поместите видео файлы в папку `uploads/`
2. Перезапустите сервер
3. Сервер автоматически создаст m3u8 плейлисты для каждого видео

Поддерживаемые форматы: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`, `.flv`, `.wmv`

## API Endpoints

### GET /health
Проверка состояния сервера

**Ответ:**
```json
{
  "status": "ok",
  "message": "Video streaming API is running"
}
```

### GET /api/videos
Получить список всех видео

**Ответ:**
```json
{
  "videos": [
    {
      "name": "video.mp4",
      "baseName": "video",
      "original": "/videos/video.mp4",
      "hls_4s": "/videos/video_4s/playlist.m3u8",
      "hls_1s": "/videos/video_1s/playlist.m3u8"
    }
  ]
}
```

### GET /api/videos/:videoName
Получить информацию о конкретном видео

**Параметры:**
- `videoName` - имя видео файла

**Ответ:**
```json
{
  "video": {
    "name": "video.mp4",
    "baseName": "video",
    "original": "/videos/video.mp4",
    "hls_4s": "/videos/video_4s/playlist.m3u8",
    "hls_1s": "/videos/video_1s/playlist.m3u8"
  }
}
```

### GET /videos/*
Статические файлы (видео, m3u8 плейлисты, сегменты)

## Структура проекта

```
test_video_streaming/
├── index.js              # Главный файл сервера
├── videoProcessor.js     # Модуль обработки видео
├── package.json          # Зависимости проекта
├── .gitignore           # Игнорируемые файлы
├── README.md            # Документация
└── uploads/             # Папка для видео файлов
    ├── video.mp4        # Исходное видео
    ├── video_4s/        # m3u8 с сегментами по 4 сек
    │   ├── playlist.m3u8
    │   ├── segment000.ts
    │   └── ...
    └── video_1s/        # m3u8 с сегментами по 1 сек
        ├── playlist.m3u8
        ├── segment000.ts
        └── ...
```

## Пример использования в HTML

```html
<!DOCTYPE html>
<html>
<head>
    <title>Video Streaming</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
    <video id="video" controls width="640" height="360"></video>
    
    <script>
        const video = document.getElementById('video');
        const videoSrc = 'http://localhost:3000/videos/video_4s/playlist.m3u8';
        
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(videoSrc);
            hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Для Safari
            video.src = videoSrc;
        }
    </script>
</body>
</html>
```

## Алгоритм работы

1. При запуске сервер проверяет папку `uploads/`
2. Для каждого найденного видео файла:
   - Создается папка `{videoName}_4s` с m3u8 плейлистом (сегменты по 4 сек)
   - Создается папка `{videoName}_1s` с m3u8 плейлистом (сегменты по 1 сек)
3. Если плейлисты уже существуют, обработка пропускается
4. Сервер предоставляет API для доступа к видео и плейлистам

## Примечания

- FFmpeg копирует кодеки без перекодирования для ускорения процесса
- Все сегменты сохраняются в плейлисте (hls_list_size = 0)
- Прогресс обработки отображается в консоли
- Уже обработанные видео пропускаются при повторном запуске

