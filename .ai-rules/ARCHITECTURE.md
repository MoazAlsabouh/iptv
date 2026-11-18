# 🏗️ PROJECT STRUCTURE & DATA FLOW

## Directory Enforcements
You must strictly follow this folder structure when creating or modifying files:

/src
  /app           # Next.js App Router pages (Home, Movies, Live TV, Settings)
  /components
    /ui          # Reusable dumb components (Buttons, Cards, Modals, Inputs)
    /player      # Video player wrappers and controls
    /layout      # Sidebar, Navbar, Page Wrappers
  /hooks         # Custom React hooks (useM3uParser, useXtreamApi, useParentalControl)
  /services      # API calls and external connections (Cloudflare API, Xtream API)
  /store         # Zustand global state configurations
  /types         # TypeScript Interfaces and Types
  /utils         # Helper functions (Time formatters, parsers)

## Core Features & Logic
1. **Parental Control:**
   - Managed via a global Zustand store.
   - If `isChildMode` is true, filter out categories labeled 'Action', 'Horror', 'Adult'.
   - Enforce a countdown timer. When it reaches 0, trigger a lock screen component.

2. **Data Fetching:**
   - The app does NOT host content. All data comes dynamically from user-provided endpoints (Xtream API or M3U link).
   - Use React Query for caching categories and channels to minimize requests to the provider API.

3. **Routing:**
   - `/` -> Dashboard (Categories overview).
   - `/movies` -> VOD Grid.
   - `/live` -> Live TV channels Grid.
   - `/play/[id]` -> Fullscreen Player View.