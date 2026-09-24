// ==UserScript==
// @name         ChatGPT Tab Status
// @name:zh-TW   ChatGPT 分頁狀態
// @namespace    https://github.com/endman100
// @version      0.2.4
// @description  Show ChatGPT execution state in the browser tab title.
// @description:zh-TW 在瀏覽器分頁標題顯示 ChatGPT 的 IDLE / THINKING / TOOL / WRITING / DONE 執行狀態。
// @author       endman100
// @homepageURL  https://github.com/endman100/chatgpt-tab-status
// @supportURL   https://github.com/endman100/chatgpt-tab-status/issues
// @match        https://chatgpt.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.2.4';
  const PREFIX_RE = /^\[(?:THINKING|TOOL|WRITING|DONE|IDLE)\]\s*/;
  const POLL_MS = 250;
  const ACTIVITY_LATCH_MS = 2500;

  let baseTitle = stripPrefix(document.title) || 'ChatGPT';
  let lastState = '';
  let toolLatchUntil = 0;
  let thinkingLatchUntil = 0;

  function stripPrefix(value) {
    return String(value || '').replace(PREFIX_RE, '').trim();
  }

  function currentBaseTitle() {
    const raw = stripPrefix(document.title);
    if (raw && raw !== baseTitle) baseTitle = raw;
    return baseTitle || 'ChatGPT';
  }

  function running() {
    return Boolean(
      document.querySelector('[data-testid="stop-button"]') ||
      document.querySelector('button[aria-label*="停止"]') ||
      document.querySelector('button[aria-label*="Stop"]')
    );
  }

  function authoredMessages() {
    return [...document.querySelectorAll('[data-message-author-role]')];
  }

  function latestRole() {
    const nodes = authoredMessages();
    return nodes.at(-1)?.getAttribute('data-message-author-role') || '';
  }

  function latestAssistantNode() {
    const nodes = authoredMessages();

    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].getAttribute('data-message-author-role') === 'assistant') {
        const node = nodes[i];
        return (
          node.closest('[data-testid^="conversation-turn-"]') ||
          node.closest('article') ||
          node.parentElement ||
          node
        );
      }
    }

    return null;
  }

  function latestUserNode() {
    const nodes = authoredMessages();

    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].getAttribute('data-message-author-role') === 'user') {
        return nodes[i];
      }
    }

    return null;
  }

  function isAfterLatestUser(el) {
    const user = latestUserNode();
    if (!user || !el) return true;

    // Ignore the current user turn itself, its descendants, and broad
    // containers that also contain it. This prevents prompt text such as
    // "搜尋網路" and re-rendered historical turns from becoming TOOL.
    if (el === user || user.contains(el) || el.contains(user)) {
      return false;
    }

    return Boolean(
      user.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
    );
  }

  function compactSignals(root) {
    if (!root) return '';

    return [...root.querySelectorAll(
      'button,[role="button"],[data-testid],[aria-label],summary,a[href]'
    )]
      .slice(-160)
      .map(el => [
        el.getAttribute('data-testid') || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('href') || '',
        el.innerText || ''
      ].join(' '))
      .join('\n');
  }

  function hasExternalSourceLink(root) {
    if (!root) return false;

    return Boolean(
      root.querySelector(
        'a[target="_blank"][href^="https://"],a[target="_blank"][href^="http://"]'
      )
    );
  }

  function hasToolState(root) {
    if (!root) return false;

    const selector = [
      '[data-testid*="tool" i]',
      '[data-testid*="search" i]',
      '[data-testid*="browse" i]',
      '[data-testid*="browser" i]',
      '[data-testid*="connector" i]',
      '[data-testid*="plugin" i]',
      '[data-testid*="app" i]'
    ].join(',');

    if (root.querySelector(selector)) return true;

    const signals = compactSignals(root);

    return /(?:正在搜尋|搜尋網頁|搜尋中|已搜尋|瀏覽網頁|正在瀏覽|Search(?:ed|ing)?(?: the)? web|Browsing|Using tool|Calling tool|Tool call|Connector|Sources?|來源)/i.test(signals);
  }

  function hasThinkingState(root) {
    if (!root) return false;

    if (
      root.querySelector(
        '[data-testid*="reason" i],[data-testid*="think" i]'
      )
    ) {
      return true;
    }

    const signals = compactSignals(root);
    return /(?:思考中|正在思考|Thinking|Reasoning)/i.test(signals);
  }

  function assistantHasAnswerText(root) {
    if (!root) return false;

    const text = String(root.innerText || root.textContent || '')
      .replace(/ChatGPT\s*(?:說|said)\s*[:：]?/gi, '')
      .replace(/(?:思考中|正在思考|Thinking|Reasoning)/gi, '')
      .replace(/處理時間為\s*\d+\s*s/gi, '')
      .trim();

    return text.length >= 2;
  }

  function nodeBlob(node) {
    const el =
      node?.nodeType === Node.ELEMENT_NODE
        ? node
        : node?.parentElement;

    if (!el) return '';

    return [
      el.getAttribute?.('data-testid') || '',
      el.getAttribute?.('aria-label') || '',
      el.getAttribute?.('href') || '',
      el.innerText || el.textContent || ''
    ].join(' ').slice(0, 2400);
  }

  function scanMutationNode(node) {
    if (!running()) return;

    const el =
      node?.nodeType === Node.ELEMENT_NODE
        ? node
        : node?.parentElement;

    if (!el) return;
    if (el.closest?.('[data-sidebar-item], nav, aside')) return;
    if (!isAfterLatestUser(el)) return;

    const blob = nodeBlob(el);
    const structuralSignal = [
      el.getAttribute?.('data-testid') || '',
      el.getAttribute?.('aria-label') || '',
      el.getAttribute?.('role') || ''
    ].join(' ');

    if (
      /(?:tool|search|browse|browser|connector|plugin)/i.test(structuralSignal) ||
      /(?:正在搜尋|搜尋網頁|搜尋中|已搜尋|瀏覽網頁|正在瀏覽|Search(?:ed|ing)?(?: the)? web|Browsing(?: the)? web|Using tool|Calling tool|Tool call)/i.test(blob)
    ) {
      toolLatchUntil = Date.now() + ACTIVITY_LATCH_MS;
      return;
    }

    if (
      /(?:思考中|正在思考|Thinking|Reasoning)/i.test(blob)
    ) {
      thinkingLatchUntil = Date.now() + ACTIVITY_LATCH_MS;
    }
  }

  function detectState() {
    const assistant = latestAssistantNode();

    if (running()) {
      if (Date.now() < toolLatchUntil) {
        return 'TOOL';
      }

      // First-principles state: request is running, but the newest authored
      // message is still the user's message, so no answer stream exists yet.
      if (latestRole() !== 'assistant') {
        return 'THINKING';
      }

      if (
        Date.now() < thinkingLatchUntil ||
        hasThinkingState(assistant) ||
        !assistantHasAnswerText(assistant)
      ) {
        return 'THINKING';
      }

      return 'WRITING';
    }

    if (assistant) return 'DONE';
    return 'IDLE';
  }

  function applyState() {
    const state = detectState();
    const title = `[${state}] ${currentBaseTitle()}`;

    document.documentElement.dataset.gptTabStatus = state;
    document.documentElement.dataset.gptTabStatusVersion = VERSION;

    if (document.title !== title) {
      document.title = title;
    }

    if (state !== lastState) {
      lastState = state;
      console.debug('[ChatGPT Tab Status]', state);
    }

    return state;
  }

  let debounceTimer = 0;

  const observer = new MutationObserver(mutations => {
    if (running()) {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          scanMutationNode(node);
        }
      }
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyState, 30);
  });

  observer.observe(document.body || document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'data-state',
      'data-testid',
      'aria-label',
      'aria-expanded',
      'href'
    ]
  });

  setInterval(applyState, POLL_MS);
  applyState();

  window.__gptTabStatus = {
    version: VERSION,
    detectState,
    refresh: applyState
  };
})();
