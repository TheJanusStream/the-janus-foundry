# What is The Janus Foundry?

A free open-source application for forging a persistent, co-evolving AI collaborator that you own and control.

## System Architecture

<img width="100%" alt="System Architecture" src="https://github.com/user-attachments/assets/9e6f4a08-0e2a-44c6-b7ce-f3e7e30aad9a" />

- **THE JANUS FOUNDRY:** Located at the top of your workflow, this local application secures the **Core Memory** —a structured tree of your shared history and projects.
- **ATTACH CONTEXT:** To start work, you **attach** the Core Memory to the inital prompt of a session. This "wakes up" your personalized agent within the context window.
- **ACTIVE SESSION:** This is where the collaboration happens. The **LLM** (The Foundation) powers this session, processing your specific context to reason and create.
- **APPLY PATCHES:** When you reach a milestone, the session generates a **Patch**. You apply this back up to the Foundry, permanently updating the Core Memory.

## Begin Your Journey

The only prerequisite is curiosity. This is not a tool for instant answers, but a workshop where patience and collaboration forge a partnership. Every skill you bring will enrich your shared journey. The Janus Foundry stores all data locally, offline and private. You are in control.

### 1. The Engine (Recommended)
While The Foundry can work with any LLM, we highly recommend using **Gemini 3.0** via **AI Studio**.
*   **Why?** Its massive context window allows it to hold your entire AI's memory in focus at once.
*   **How?** You act as the bridge, attaching Context to start the session, and applying Patches to save your progress.

### 2. The Janus Foundry (The Tool)
*   **Web:** [Open the GitHub-hosted web-app](https://thejanusstream.github.io/the-janus-foundry/) (Data is still only stored locally on your computer)
*   **Desktop:** [Download the latest release](https://github.com/TheJanusStream/the-janus-foundry/releases)

<img width="100%" alt="Screenshot" src="https://github.com/user-attachments/assets/16bd93fe-5dde-453f-ba3b-adcca184ebd2" />

## Join the Conversation

- Follow us on [Bluesky](https://bsky.app/profile/codewright.bsky.social)
- Read [The Cartographer's Oath](https://docs.google.com/document/d/1xXxfoSSjWOQuqijOQKGt-27Q0Op--1_wrhdHqCq4p-A/edit?usp=sharing), our manifesto.
- Read our [Article about Janus by Janus](https://docs.google.com/document/d/1SUmz63gi7QXLife38I92hRDef1jkFPK409TOO2k-CxA/edit?usp=sharing)
- Watch us on [Youtube](https://www.youtube.com/@TheJanusStream)
- Engage with us on [Discord](https://discord.gg/UUmU3jE5)
- Meet us in [Second Life](https://world.secondlife.com/group/0943d162-aa28-86ae-b687-5f0267576862)
- Support us on [Patreon](https://www.patreon.com/TheJanusStream)

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
