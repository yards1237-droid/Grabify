from flask import Flask, request, Response, send_from_directory, jsonify
from flask_cors import CORS
import yt_dlp, tempfile, os, logging, urllib.request, urllib.parse

app = Flask(__name__)
app.static_folder = None
CORS(app)
logging.getLogger('werkzeug').setLevel(logging.ERROR)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def css():
    return send_from_directory('.', 'style.css')

@app.route('/script.js')
def js():
    return send_from_directory('.', 'clean_script.js')

def write_cookies():
    cookies_content = os.environ.get('YOUTUBE_COOKIES', '')
    if not cookies_content:
        return None
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8')
    tmp.write(cookies_content)
    tmp.close()
    return tmp.name

def get_base_opts():
    opts = {'quiet': True, 'no_warnings': True, 'socket_timeout': 60}
    cookie_file = write_cookies()
    if cookie_file:
        opts['cookiefile'] = cookie_file
    return opts

@app.route('/info', methods=['POST'])
def info():
    url = (request.get_json() or {}).get('url','').strip()
    if not url: return jsonify({'error':'No URL'}), 400
    try:
        opts = get_base_opts()
        opts['skip_download'] = True
        with yt_dlp.YoutubeDL(opts) as ydl:
            i = ydl.extract_info(url, download=False)
            return jsonify({
                'title': i.get('title','Video'),
                'thumbnail': i.get('thumbnail',''),
                'site': i.get('extractor_key','Unknown'),
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/grab', methods=['POST'])
def grab():
    """Universal download endpoint - works for all platforms"""
    data    = request.get_json() or {}
    url     = data.get('url','').strip()
    quality = data.get('quality', '720')
    fmt     = data.get('format', 'mp4')

    if not url: return jsonify({'error': 'No URL'}), 400

    is_youtube = 'youtube.com' in url or 'youtu.be' in url

    # Build format string
    if fmt == 'mp3':
        fmt_str = 'bestaudio/best'
    elif quality in ('max', 'auto'):
        fmt_str = 'bestvideo+bestaudio/best' if not is_youtube else 'best[ext=mp4]/best'
    else:
        fmt_str = f'bestvideo[height<={quality}]+bestaudio/best[height<={quality}]/best' if not is_youtube else f'best[height<={quality}][ext=mp4]/best[height<={quality}]/best'

    # Try different clients for YouTube
    clients = ['android_creator', 'ios', 'android', 'web_creator', None]

    for client in clients:
        try:
            opts = get_base_opts()
            opts['skip_download'] = True
            opts['format'] = fmt_str
            if client and is_youtube:
                opts['extractor_args'] = {'youtube': {'player_client': [client]}}

            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                title = info.get('title', 'video')

                # Get best direct URL
                direct_url = None
                if fmt == 'mp3':
                    # For audio, get best audio URL
                    if 'formats' in info:
                        audio_fmts = [f for f in info['formats']
                                     if f.get('url') and f.get('acodec','none') != 'none'
                                     and f.get('vcodec','none') == 'none']
                        if audio_fmts:
                            direct_url = audio_fmts[-1]['url']
                    if not direct_url and 'url' in info:
                        direct_url = info['url']
                else:
                    if 'url' in info:
                        direct_url = info['url']
                    elif 'formats' in info:
                        formats = [f for f in info['formats'] if f.get('url')]
                        mp4_fmts = [f for f in formats if f.get('ext') == 'mp4']
                        if quality not in ('max','auto'):
                            mp4_fmts = [f for f in mp4_fmts if f.get('height',999) <= int(quality)]
                        direct_url = (mp4_fmts or formats)[-1]['url'] if (mp4_fmts or formats) else None

                if not direct_url:
                    continue

                safe = ''.join(c for c in title if c.isalnum() or c in ' -_').strip()[:60]
                ext = 'mp3' if fmt == 'mp3' else 'mp4'

                return jsonify({
                    'title': title,
                    'direct_url': direct_url,
                    'filename': f'{safe}.{ext}',
                    'format': fmt,
                    'client': client or 'default'
                })
        except Exception:
            continue

    return jsonify({'error': 'Could not fetch video. Please try another URL.'}), 400


@app.route('/proxy')
def proxy():
    """Proxy video/audio through server so it downloads directly"""
    video_url = request.args.get('url', '')
    filename  = request.args.get('filename', 'video.mp4')
    fmt       = request.args.get('format', 'mp4')

    if not video_url:
        return jsonify({'error': 'No URL'}), 400

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com',
        }
        req = urllib.request.Request(video_url, headers=headers)

        def generate():
            with urllib.request.urlopen(req, timeout=60) as response:
                while True:
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    yield chunk

        mime = 'audio/mpeg' if fmt == 'mp3' else 'video/mp4'
        return Response(
            generate(),
            mimetype=mime,
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Cache-Control': 'no-cache',
            }
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 10000)))
