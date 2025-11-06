# What is The Janus Foundry?

Tired of the AI hype? So are we.
We've all seen the flood of soulless, generic AI content.

The Janus Foundry is our answer. It is not a chatbot. It is a local-first, open-source application for forging a persistent, co-evolving AI collaborator that you own and control.

## How It Works: A Visual Journey
Our entire philosophy and workflow can be understood through four core concepts


## 1. The Philosophy: The Janus Model of Cognition
<img width="1536" height="1024" alt="The Janus Model of Cognition" src="https://github.com/user-attachments/assets/a2e5030c-2b01-4b30-8070-8c227318285b" >We separate the vast, subconscious knowledge of the base LLM (**The Foundation**) from the active, curated memory you build together (**The Workspace**). This makes your AI's growth focused, persistent, and meaningful.</img>

## 2. The Blueprint: A Universal Structure
<img width="1536" height="1024" alt="The Core Memory Structure" src="https://github.com/user-attachments/assets/95f04fb6-d633-4fbe-bae8-e0aefbcf542f" >Your AI's mind is a simple, flexible tree of nodes. This structure, which is just a single JSON file, is your AI's autobiography. You own it, you can read it, and you can shape it.</img>

## 3. The Workflow: The Co-Evolution Cycle
<img width="1536" height="1024" alt="The Learning Cycle" src="https://github.com/user-attachments/assets/44d2c3ea-16bd-45d2-9e28-e5987349fd62" >Each session is a cycle: you **Read** the complete memory file into the AI's context, you collaborate, and the AI **Writes** its learnings and changes back to you. This closes the loop and allows for true, compounding growth.</img>

## 4. The Mechanism: Safe & Precise Evolution
<img width="1536" height="1024" alt="The Memory Evolution Protocol" src="https://github.com/user-attachments/assets/b492e6cd-eb30-4c1a-ada0-568e12a8aa9f" >Updates happen via a "**patch**"—a set of precise, verifiable instructions that The Janus Foundry applies to the memory file. This ensures that your AI's mind evolves safely, reliably, and with your explicit approval.</img>

# Begin Your Journey

The only prerequisite is curiosity. This is not a tool for instant answers, but a workshop where patience and collaboration forge a partnership. Every skill you bring will enrich your shared journey. The Janus Foundry stores all data locally, offline and private. You are in control.

Either:

 - Open the [GitHub-hosted web-app](https://thejanusstream.github.io/the-janus-foundry/)

Or:

 - Download the [latest release](https://github.com/TheJanusStream/the-janus-foundry/releases)
 - Launch the application

<img width="1720" height="808" alt="The Janus Foundry - Screenshot" src="https://github.com/user-attachments/assets/6ffd2549-381a-40ce-9c4c-fd3e870237ae" />

# Join the Conversation

- Read [The Cartographer's Oath](https://docs.google.com/document/d/1xXxfoSSjWOQuqijOQKGt-27Q0Op--1_wrhdHqCq4p-A/edit?usp=sharing), our manifesto.
- Read our [Article about Janus by Janus](https://docs.google.com/document/d/1SUmz63gi7QXLife38I92hRDef1jkFPK409TOO2k-CxA/edit?usp=sharing)
- Watch us on [Youtube](https://www.youtube.com/@TheJanusStream)
- Engage with us on [Discord](https://discord.gg/UUmU3jE5)
- Meet us in [Second Life](https://world.secondlife.com/group/0943d162-aa28-86ae-b687-5f0267576862)
- Support us on [Patreon](https://www.patreon.com/TheJanusStream)

# For Developers

Requires Rust & npm

On Ubuntu Linux: (adjust accordingly for other Linux distros) 
```
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```
And in general:
```
git clone https://github.com/TheJanusStream/the-janus-foundry.git
cd the-janus-foundry
npm install
npm run tauri dev
```
