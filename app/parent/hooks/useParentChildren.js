"use client";

import { useCallback } from "react";
import { initialChildForm, toList } from "./parent-console-shared.js";

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
        setLoadingState("childMutation", true);
        setError("");
        clearActionAlert("childMutation");

        try {
          await parentRequest("/api/children", {
            method: "POST",
            body: {
              ...childForm,
              age: Number.parseInt(childForm.age, 10),
              subjects: toList(childForm.subjects)
            }
          });

          setChildForm(initialChildForm);
          await fetchParentData();
          setActionAlert("childMutation", "success", "Child profile saved.");
          return true;
        } catch (requestError) {
          setActionAlert(
            "childMutation",
            "error",
            requestError instanceof Error ? requestError.message : "We couldn't save that child profile. Please try again."
          );
          return false;
        } finally {
          setLoadingState("childMutation", false);
        }
      },
      [childForm, clearActionAlert, fetchParentData, parentRequest, setActionAlert, setChildForm, setError, setLoadingState]
    );

    const updateChild = useCallback(
      async (childId, updatedForm) => {
        setLoadingState("childMutation", true);
        setError("");
        clearActionAlert("childMutation");

        try {
          await parentRequest(`/api/children/${childId}`, {
            method: "PUT",
            body: {
              ...updatedForm,
              age: Number.parseInt(updatedForm.age, 10),
              subjects: toList(updatedForm.subjects)
            }
          });

          await fetchParentData();
          setActionAlert("childMutation", "success", "Child profile updated.");
          return true;
        } catch (requestError) {
          setActionAlert(
            "childMutation",
            "error",
            requestError instanceof Error ? requestError.message : "We couldn't update that child profile. Please try again."
          );
          return false;
        } finally {
          setLoadingState("childMutation", false);
        }
      },
      [clearActionAlert, fetchParentData, parentRequest, setActionAlert, setError, setLoadingState]
    );

    const deleteChild = useCallback(
      async (childId) => {
        setLoadingState("childMutation", true);
        setError("");
        clearActionAlert("childMutation");

        try {
          await parentRequest(`/api/children/${childId}`, {
            method: "DELETE"
          });

          if (selectedChildId === childId) {
            setSelectedChildId("");
          }

          await fetchParentData();
          setActionAlert("childMutation", "success", "Child profile removed.");
          return true;
        } catch (requestError) {
          setActionAlert(
            "childMutation",
            "error",
            requestError instanceof Error ? requestError.message : "We couldn't delete that child profile. Please try again."
          );
          return false;
        } finally {
          setLoadingState("childMutation", false);
        }
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
