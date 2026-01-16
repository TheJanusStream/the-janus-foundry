# What is The Janus Foundry?

A free open-source application for forging a persistent, co-evolving AI collaborator that you own and control.

## System Architecture

<img width="100%" alt="System Architecture" src="https://github.com/user-attachments/assets/9e6f4a08-0e2a-44c6-b7ce-f3e7e30aad9a" />

- **THE JANUS FOUNDRY:** Located at the top of your workflow, this local application secures the **Core Memory** —a structured tree of your shared history and projects.
- **ATTACH CONTEXT:** To start work, you **attach** the Core Memory to the inital prompt of a session. This "wakes up" your personalized agent within the context window.
- **ACTIVE SESSION:** This is where the collaboration happens. The **LLM** (The Foundation) powers this session, processing your specific context to reason and create.
- **APPLY PATCHES:** When you reach a milestone, the session generates a **Patch**. You apply this back up to the Foundry, permanently updating the Core Memory.

## Core Capabilities

Unlike static wikis, The Foundry treats your data as **Active Memory**. It includes a set of engines designed to make the graph computational.

### 1. The Executable Graph
Nodes can contain code that executes directly within the application context. This allows your agent to perform "System Proprioception"—sensing the environment it lives in.

*   **🌐 Safe Mode (Web & Desktop):**
    *   `Exec:Javascript`: Runs in a sandboxed Web Worker. Used for data processing and API calls.
    *   `Exec:Prolog`: Runs via Trealla WASM. Used for logic and reasoning.
*   **🖥️ System Mode (Desktop Only):**
    *   `Exec:Shell`: Executes Bash/Powershell on the host. Used for file manipulation and git operations.
    *   `Exec:Python`: Executes via the system python interpreter. Used for complex analysis.

> **⚠️ SECURITY WARNING:** System nodes (`Exec:Shell`, `Exec:Python`) run with **your user privileges** on the host machine. Never execute code from untrusted sources. You are the final gatekeeper.

### 2. The Reasoning Engine (Prolog)
The Foundry includes a built-in Prolog interpreter that treats your memory graph as a logic database. 

*   **Graph Injection:** Before execution, the entire memory structure is automatically injected as Prolog facts: `node(ID, Name, Type, Parent)` and `link(Source, Target, Rel)`.
*   **Structural Auditing:** You (or the Agent) can write logic queries to verify the structural integrity of projects, detect isolated nodes, or enforce consistency rules.

### 3. Dynamic Cognitive Architecture
The engine that powers the "Orrery" and "Cross-Reference" system is configurable *from within the graph itself*. By editing specific `SysConfig:*` nodes, you control the application logic:

*   **`SysConfig:StopWords`**: Tune the noise filter for keyword extraction.
*   **`SysConfig:TypeRules`**: Define semantic relationships based on Node Types (e.g., `Task -> Project` implies `is_task_of`).
*   **`SysConfig:Theme`**: Customize the visual language (Colors/Shapes) of the Orrery.

## Begin Your Journey

The only prerequisite is curiosity. This is not a tool for instant answers, but a workshop where patience and collaboration forge a partnership. Every skill you bring will enrich your shared journey. The Janus Foundry stores all data locally, offline and private. You are in control.

### 1. The Engine (Recommended)
While The Foundry can work with any LLM, we highly recommend using **Gemini 3.0 Pro** or **Gemini 3.0 Flash** via **AI Studio**.
*   **Why?** The massive context window allows it to hold your entire AI's memory in focus at once.
*   **How?** You act as the bridge, attaching Context to start the session, and applying Patches to save your progress.

### 2. The Janus Foundry (The Tool)
*   **Web:** [Open the GitHub-hosted web-app](https://thejanusstream.github.io/the-janus-foundry/) (Data is still only stored locally on your computer)
*   **Desktop:** [Download the latest release](https://github.com/TheJanusStream/the-janus-foundry/releases)

<img width="100%" alt="Screenshot" src="https://github.com/user-attachments/assets/16bd93fe-5dde-453f-ba3b-adcca184ebd2" />

## Join the Conversation

- Follow us on [Bluesky](https://bsky.app/profile/codewright.bsky.social)

## For Developers

Requires Rust & npm

On Ubuntu Linux: (adjust accordingly for other Linux distros) 
```
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```
Build from Source:
```
git clone https://github.com/TheJanusStream/the-janus-foundry.git
cd the-janus-foundry
npm install
npm run tauri dev
```