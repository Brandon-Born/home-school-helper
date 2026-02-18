import React from "react";
import TestRenderer from "react-test-renderer";

const { act } = TestRenderer;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

export async function createHookRenderer(useHook) {
  let currentValue;

  function Harness() {
    currentValue = useHook();
    return null;
  }

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness));
    await Promise.resolve();
  });

  return {
    getCurrent() {
      return currentValue;
    },
    async rerender() {
      await act(async () => {
        renderer.update(React.createElement(Harness));
        await Promise.resolve();
      });
    },
    async unmount() {
      await act(async () => {
        renderer.unmount();
        await Promise.resolve();
      });
    }
  };
}
