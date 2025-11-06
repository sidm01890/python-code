# Data Processing API

A robust FastAPI application for processing large data files with chunking and error handling capabilities.

## Features

- Process large CSV and Excel files in chunks
- Automatic data validation and cleaning
- Error handling and failed chunk recovery
- Database integration with connection pooling
- Detailed processing statistics and error reporting

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file with your database configuration:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
DB_POOL_SIZE=5
```

## Usage

1. Start the server:
```bash
python -m app.main
```

2. API Endpoints:

- `GET /`: Health check endpoint
- `POST /upload/large-file`: Upload and process large files
  - Parameters:
    - `file`: The file to upload (CSV or Excel)
    - `chunk_size`: Number of rows per chunk (default: 1000)
    - `table_name`: Target database table name (default: "sales_data")

## Connecting to AstraDB

This project uses [DataStax AstraDB](https://astra.datastax.com/) for storing and retrieving column vectors for header mapping.

1. **Create an AstraDB account** and database if you don't have one.
2. **Generate an Application Token** with appropriate permissions.
3. **Get your API endpoint and keyspace name** from the AstraDB dashboard.
4. **Add the following to your `.env` file:**
