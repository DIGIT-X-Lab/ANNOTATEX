# AnnotateX

> Transform text into structure

A sleek, minimalistic, and powerful text annotation platform by **Digit-X Labs**, creators of MosaicX.

![AnnotateX](https://img.shields.io/badge/version-1.0.0-00B8D9)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-blue)

## Features

✨ **Highlight & Label** - Select text spans and assign entity labels with keyboard shortcuts  
🔗 **Relationship Mapping** - Drag connections between annotated entities  
📊 **Live JSON Output** - Real-time structured data preview  
🎨 **Custom Schemas** - Define your own ontologies and label systems  
⚡ **Keyboard-First** - Fast annotation with `/label` and `/relate` shortcuts  
📦 **Export Ready** - Download as JSON or CSV  
🌓 **Dark Mode** - Beautiful in light or dark theme  
🤖 **AI Assist** - Smart label suggestions (coming soon)

## Quick Start

### With Docker (Recommended)

```bash
docker-compose up -d
```

Access at `http://localhost:8080`

### Manual Setup

```bash
npm install
npm run dev
```

## On-Premises Deployment

AnnotateX is designed for self-hosting. See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete deployment guide including:

- Docker deployment
- Nginx/Apache configuration  
- SSL/TLS setup
- Production hardening
- Monitoring & troubleshooting

### Quick Deploy Script

```bash
chmod +x deploy.sh
./deploy.sh prod
```

## Project Info

**Lovable Project URL**: https://lovable.dev/projects/640e5da5-ff22-496f-b6ca-451f71c1cd5e

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/640e5da5-ff22-496f-b6ca-451f71c1cd5e) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/640e5da5-ff22-496f-b6ca-451f71c1cd5e) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
