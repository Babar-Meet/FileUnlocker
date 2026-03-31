# FileUnlocker

FileUnlocker is a production-oriented web application for students and faculty to safely process files.

It supports:

- Restriction-based unlocking (non-password protections only)
- File conversion and best-effort repair
- File optimization and metadata stripping

## Security Principle

This application **does not bypass strong encryption, passwords, DRM, or secure cryptographic protections**.

When a file is strongly encrypted, the backend returns:

`❌ This file is securely encrypted and requires the original password.`

## Tech Stack

- Frontend: React (Vite), TailwindCSS
- Backend: Node.js, Express, Multer, in-memory async queue
- Processing: qpdf, LibreOffice, mammoth, exceljs, jszip, sharp

## Project Structure

```text
.
├─ client/           # React + Vite frontend
├─ server/           # Express API backend
└─ utils/            # Shared file processors and helpers
```

## Core API

- `POST /process`
- `GET /download/:id`

## Features Implemented

1. Smart file auto-detection and routing
2. Restriction removal (PDF, DOCX, PPTX, XLSX, ZIP attempt)
3. Convert and fix:
   - PDF -> DOCX
   - DOCX -> PDF
   - PPTX -> PDF
   - XLSX -> PDF
   - JPG/PNG -> PDF
4. Optimization and normalization
5. Download system with renamed output (`originalname_processed.ext`)
6. Drag-drop UI with status and one-click download
7. Smart error messaging:
   - Password required
   - Unsupported file
   - File corrupted
   - Processing failed
8. Security controls:
   - MIME + extension validation
   - 50MB upload limit
   - Temp-directory processing
   - Auto cleanup after processing/download

## Prerequisites

- Node.js 20+
- npm 10+
- qpdf CLI available in PATH
- LibreOffice CLI (`soffice`) available in PATH

### Install qpdf + LibreOffice

#### Windows

```powershell
choco install qpdf libreoffice-fresh -y
```

If `soffice` is not in PATH, set environment variable in `server/.env`:

```env
LIBREOFFICE_BIN="C:\Program Files\LibreOffice\program\soffice.exe"
QPDF_BIN=qpdf
```

#### macOS

```bash
brew install qpdf --cask libreoffice
```

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y qpdf libreoffice
```

## Local Setup

1. Install all workspace dependencies:

```bash
npm install
```

2. Create backend environment file:

```bash
cp server/.env.example server/.env
```

3. Start frontend + backend together:

```bash
npm run dev
```

4. Open app:

```text
http://localhost:5173
```

Backend health check:

```text
http://localhost:5000/health
```

## Quick Start (Automation)

For a fast setup and execution on Windows, use the provided batch files:

- **`setup.bat`**: Installs all required Node.js dependencies and creates a default `.env` file.
- **`start.bat`**: Launches both the frontend and backend in one terminal.

## Technical Documentation

For a deep dive into the architecture, API endpoints, logic flow, and security model, please refer to the **[TECH_DOCS.md](TECH_DOCS.md)** file.

## Manual API Usage

### Process a file

```bash
curl -X POST http://localhost:5000/process \
  -F "file=@/path/to/file.pdf" \
  -F "operation=auto"
```

Optional fields:

- `operation`: `auto | unlock | convert | optimize | repair`
- `targetFormat`: required when operation is `convert` (example: `pdf`, `docx`)

### Download result

```bash
curl -L "http://localhost:5000/download/<downloadId>" -o output.file
```

## Deployment Guide

## Render

1. Create a new Web Service from this repository.
2. Set root directory to `server`.
3. Build command:

```bash
npm install
```

4. Start command:

```bash
npm start
```

5. Add environment variables:

- `PORT=10000` (or Render default)
- `QPDF_BIN=qpdf`
- `LIBREOFFICE_BIN=soffice`

6. Use Render native apt packages via `render.yaml` or custom Docker if system binaries are missing.

Recommended for reliability: deploy with Docker so qpdf and LibreOffice are guaranteed in the container image.

## Railway

1. Create a new project from this repository.
2. Service root directory: `server`.
3. Add build and run commands:

```bash
npm install
npm start
```

4. Add variables:

- `QPDF_BIN=qpdf`
- `LIBREOFFICE_BIN=soffice`

5. If binaries are unavailable in default runtime, switch to Docker deploy.

## Notes for Production Hardening

- Replace in-memory download store with Redis or database-backed job/result tracking.
- Add antivirus scanning for uploaded files.
- Add rate limiting and auth for multi-tenant deployments.
- Move queue to BullMQ + Redis for horizontal scaling.
- Add persistent object storage (S3, Blob, GCS) for output lifecycle.
