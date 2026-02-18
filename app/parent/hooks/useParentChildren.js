"use client";

import { useCallback } from "react";
import { initialChildForm, toList } from "./parent-console-shared.js";
import { runAsyncActionStatus } from "./parent-action-status.js";

export function createUseParentChildren() {
  return function useParentChildren({
    parentRequest,
    childForm,
    selectedChildId,
    fetchParentData,
    setLoadingState,
    setError,
    clearActionAlert,
    setActionAlert,
    setChildForm,
    setSelectedChildId
  }) {
    const createChild = useCallback(
      async (event) => {
        event.preventDefault();
        const outcome = await runAsyncActionStatus({
          actionKey: "childMutation",
          setLoadingState,
          setError,
          clearActionAlert,
          setActionAlert,
          fallbackErrorMessage: "We couldn't save that child profile. Please try again.",
          run: async () => {
            await parentRequest("/api/children", {
              method: "POST",
              body: {
                ...childForm,
                age: Number.parseInt(childForm.age, 10),
                subjects: toList(childForm.subjects)
              }
            });
          },
          onSuccess: async () => {
            setChildForm(initialChildForm);
            await fetchParentData();
            return "Child profile saved.";
          }
        });

        return outcome.ok;
      },
      [childForm, clearActionAlert, fetchParentData, parentRequest, setActionAlert, setChildForm, setError, setLoadingState]
    );

    const updateChild = useCallback(
      async (childId, updatedForm) => {
        const outcome = await runAsyncActionStatus({
          actionKey: "childMutation",
          setLoadingState,
          setError,
          clearActionAlert,
          setActionAlert,
          fallbackErrorMessage: "We couldn't update that child profile. Please try again.",
          run: async () => {
            await parentRequest(`/api/children/${childId}`, {
              method: "PUT",
              body: {
                ...updatedForm,
                age: Number.parseInt(updatedForm.age, 10),
                subjects: toList(updatedForm.subjects)
              }
            });
          },
          onSuccess: async () => {
            await fetchParentData();
            return "Child profile updated.";
          }
        });

        return outcome.ok;
      },
      [clearActionAlert, fetchParentData, parentRequest, setActionAlert, setError, setLoadingState]
    );

    const deleteChild = useCallback(
      async (childId) => {
        const outcome = await runAsyncActionStatus({
          actionKey: "childMutation",
          setLoadingState,
          setError,
          clearActionAlert,
          setActionAlert,
          fallbackErrorMessage: "We couldn't delete that child profile. Please try again.",
          run: async () => {
            await parentRequest(`/api/children/${childId}`, {
              method: "DELETE"
            });
          },
          onSuccess: async () => {
            if (selectedChildId === childId) {
              setSelectedChildId("");
            }

            await fetchParentData();
            return "Child profile removed.";
          }
        });

        return outcome.ok;
      },
      [clearActionAlert, fetchParentData, parentRequest, selectedChildId, setActionAlert, setError, setLoadingState, setSelectedChildId]
    );

    return {
      createChild,
      updateChild,
      deleteChild
    };
  };
}

export const useParentChildren = createUseParentChildren();
