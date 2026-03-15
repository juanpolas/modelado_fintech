from pathlib import Path

from dotenv import load_dotenv

from fintech_app.app import app

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env', override=False)

if __name__ == '__main__':
    import os

    host = os.getenv('BACKEND_HOST', '0.0.0.0')
    port = int(os.getenv('BACKEND_PORT', '8000'))
    debug = os.getenv('BACKEND_DEBUG', 'false').lower() == 'true'
    app.run(host=host, port=port, debug=debug)
