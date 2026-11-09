import sys
from chromadb.cli.cli import app

if __name__ == '__main__':
    # Start Chroma server on localhost:8000 using the local chroma_data directory
    sys.argv = ['chroma', 'run', '--path', './backend/chroma_data', '--host', 'localhost', '--port', '8000']
    app()
