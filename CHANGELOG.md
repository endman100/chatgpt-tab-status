# Changelog

## 0.2.4

- Shows IDLE, THINKING, TOOL, WRITING, and DONE in ChatGPT tab titles.
- Reduces false TOOL detection caused by tool/search words in the user's own prompt.
- Ignores sidebar/navigation mutations for active tool detection.
- Adds short activity latches for transient THINKING/TOOL states.
- Exposes current state and script version on `document.documentElement.dataset` for diagnostics.
