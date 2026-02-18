import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

let domInitialized = false;

function ensureDomEnvironment() {
  if (domInitialized) {
    return;
  }

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/"
  });
  const { window } = dom;

  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", {
    value: window.navigator,
    configurable: true
  });
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Node = window.Node;
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  domInitialized = true;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

export async function createHookRenderer(useHook) {
  ensureDomEnvironment();

  let currentValue;
  const container = document.createElement("div");
  document.body.appendChild(container);

  function Harness() {
    currentValue = useHook();
    return null;
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(Harness));
    await Promise.resolve();
  });

  return {
    getCurrent() {
      return currentValue;
    },
    async rerender() {
      await act(async () => {
        root.render(React.createElement(Harness));
        await Promise.resolve();
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
      container.remove();
    }
  };
}
