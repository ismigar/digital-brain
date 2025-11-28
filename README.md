# Digital Brain 🧠

Digital Brain is a powerful visualization tool that connects your Notion notes into an interactive knowledge graph. It uses a hybrid approach combining **tag-based analysis** and **AI semantic analysis** to discover and visualize connections between your permanent notes, reading notes, and indexes.

## ✨ Features

-   **Hybrid Analysis**:
    -   **Tag-based**: Instantly connects notes that share common tags.
    -   **AI-based**: Uses a local AI model (e.g., Ollama with qwen2.5) to find deep semantic connections between note contents.
-   **Interactive Graph**: Visualizes your knowledge base using a high-performance graph renderer (Sigma.js).
-   **Notion Integration**: Directly fetches data from your Notion database and can update relations back to Notion.
-   **Automated Pipeline**: A Python pipeline that processes your notes and generates a graph structure.
-   **Modern UI**: A clean React + Vite frontend to explore your digital brain.

## 🚀 Prerequisites

-   **Python 3.10+**
-   **Node.js** & **npm**
-   **Notion Integration**: You need a Notion Integration Token and the ID of the database you want to visualize.
-   **(Optional) Local AI**: [Ollama](https://ollama.com/) or any OpenAI-compatible API for semantic analysis.

## 🛠️ Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd digital-brain
    ```

2.  **Install Backend Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Install Frontend Dependencies:**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

## ⚙️ Configuration

1.  Create a `.env` file in the root directory (copy from a template if available, or set the following):

    ```env
    # Notion Configuration
    NOTION_TOKEN=secret_...
    NOTION_DATABASE=...

    # AI Configuration (Example for Ollama)
    AI_MODEL_URL=http://localhost:11434/v1/chat/completions
    AI_MODEL_NAME=qwen2.5
    AI_TIMEOUT=120

    # Paths
    OUT_GRAPH=./frontend/public/graph.json
    OUT_JSON=./output/suggestions.json
    LOG_DIR=./logs

    # Server
    SERVER_HOST=0.0.0.0
    SERVER_PORT=5001
    ```

2.  Ensure your Notion database has the expected properties (e.g., "Tags", "Note type", "Projects").

## 🏃 Usage

### 1. Run the Analysis Pipeline
This script fetches data from Notion, runs the AI/Tag analysis, and generates the graph JSON.

```bash
python pipeline/suggest_connections_digital_brain.py
```

### 2. Build the Frontend
Compile the React application.

```bash
cd frontend
npm run build
cd ..
```

### 3. Start the Server
Run the Flask server to serve the API and the frontend.

```bash
python backend/app.py
```

Access your Digital Brain at `http://localhost:5001`.

## 📂 Project Structure

-   `backend/`: Flask server application.
-   `frontend/`: React + Vite frontend application.
-   `pipeline/`: Python scripts for data fetching, AI analysis, and graph generation.
    -   `suggest_connections_digital_brain.py`: Main pipeline script.
    -   `ai_client.py`: AI model interaction.
    -   `notion_api.py`: Notion API client.
-   `config/`: Configuration files and schemas.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
