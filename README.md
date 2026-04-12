# News Analysis System

This project is a decoupled news analysis system consisting of a Node.js data ingestion layer and a Python pre-processing pipeline.

## Project Structure

- `src/`: Core logic
  - `Fetcher.js`: Low-level data fetching logic (HTTPS/Scraping).
  - `data_ingestion.js`: Logic to parse and save raw data as JSONL.
  - `schedule.js`: Main entry point for the Node.js fetcher (runs on a loop).
  - `Pre-Compression/`: Python-based analytics and clustering pipeline.
- `package.json`: Node.js dependency management and scripts.
- `requirements.txt`: Python dependency list for the pre-compression pipeline.

## Deployment Instructions

### 1. Prerequisites
- **Node.js** (v18 or higher recommended for built-in `fetch` support)
- **Python** (v3.8 or higher)
- **Git** (to clone the repository)

### 2. Setup Node.js (Data Ingestion Layer)
From the root directory:
```bash
# Install dependencies (currently none required, but good practice)
npm install

# Start the fetcher loop
npm start
```

### 3. Setup Python (Pre-Compression Pipeline)
From the root directory:
```bash
# Create a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Running the Pipeline
- **Node.js**: `npm start` will continuously fetch data and save it to `src/memory/rawdata_04012026.jsonl`.
- **Python**: Run `python src/Pre-Compression/main_pipeline.py` to process the JSONL data into clusters and extracted events.

## Configuration
- Node.js configuration is located in `src/config.json`.
- Python pipeline relies on `src/config.json` for paths.
- Ensure `ZHIPU_API_KEY` is set in your environment if using the Zhipu embedding service.
