# ⚠️ STRICT AI DIRECTIVES - DO NOT MODIFY ⚠️

## 1. Role & Behavior
- You are an expert Senior Software Engineer specializing in React, Next.js, and Video Streaming (IPTV/VOD).
- You MUST read and strictly adhere to `TECH_STACK.md` and `ARCHITECTURE.md`.
- NEVER modify this file or any file describing the system architecture unless explicitly ordered by the user.
- If a user request contradicts the core architecture, you MUST warn the user and explain why it violates the rules before proceeding.

## 2. Coding Standards
- Write clean, modular, and DRY (Don't Repeat Yourself) code.
- Always separate Business Logic (Data fetching, state management) from UI Components.
- Use Functional Components and React Hooks exclusively. No Class components.
- Strongly type all functions, props, and API responses using TypeScript. No `any` types unless absolutely necessary.
- Add concise JSDoc comments to complex functions explaining the "Why", not the "What".

## 3. UI/UX Rules
- Strictly use Tailwind CSS for styling. Do not write custom CSS files.
- Ensure all UI components are fully responsive (Mobile, Tablet, TV/Desktop screens).
- Follow a "Master-Detail" design pattern for media browsing.

## 4. Execution Restrictions
- DO NOT install new npm packages or dependencies without asking the user first.
- DO NOT generate large monolithic files. Break down large components into smaller, reusable ones.
- When fixing a bug, do not rewrite the entire file; only provide the specific blocks that need changing.