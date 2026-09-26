# ChatGPT Tab Status

A lightweight userscript that shows the current ChatGPT execution state directly in the browser tab title.

> **Quick install:** [Install the userscript with Tampermonkey / Violentmonkey](https://raw.githubusercontent.com/endman100/chatgpt-tab-status/main/chatgpt-tab-status.user.js)

## States

- `[IDLE]` — no active response
- `[THINKING]` — ChatGPT is processing before answer text is available
- `[TOOL]` — a tool/search/browser/connector activity is detected
- `[WRITING]` — answer text is streaming
- `[DONE]` — the response is complete

Examples:

```text
[THINKING] JavaScript event loop
[WRITING] JavaScript event loop
[DONE] JavaScript event loop
```

## Why

When several ChatGPT tabs are running at the same time, it is difficult to see which tab is still working without opening every tab. This script exposes that state at the tab level.

## Install

1. Install Tampermonkey or Violentmonkey.
2. Click [**Install ChatGPT Tab Status**](https://raw.githubusercontent.com/endman100/chatgpt-tab-status/main/chatgpt-tab-status.user.js).
3. Confirm the installation in your userscript manager.
4. Open or reload `https://chatgpt.com/`.

## Privacy

The script runs entirely in the browser. It does not call the OpenAI API, does not send analytics, and does not transmit conversation content.

## Implementation

It observes the ChatGPT page DOM with `MutationObserver`, detects UI state signals, and updates `document.title`.

## Compatibility

Tested with Google Chrome, Tampermonkey 5.5, and ChatGPT Web. Detection includes Traditional Chinese and English UI signals.

## Limitation

ChatGPT's web UI is not a stable public API. DOM attributes and labels can change, so future ChatGPT updates may require detector adjustments.

## Current version

`0.2.4`

## License

No open-source license has been selected yet.
