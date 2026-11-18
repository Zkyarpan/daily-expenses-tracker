"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { startRouteProgress } from "@/components/layout/RouteProgress";
import { profileApi } from "@/lib/api/profile";

import { PROFILE_KEYS } from "./useProfile";

/** Every profile write goes through the /api/profile backend. */
export function useProfileMutations() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const refreshActivity = () => queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.activity });
  const goToLogin = () => {
    queryClient.clear();
    startRouteProgress();
    router.push("/login");
    router.refresh();
  };

  const updateProfile = useMutation({
    mutationFn: profileApi.update,
    onSuccess: () => {
      refreshActivity();
      // Income and savings goal feed "Saved this month" on Home.
      queryClient.invalidateQueries({ queryKey: ["money"] });
      queryClient.invalidateQueries({ queryKey: ["plan"] });
      // Re-render server components (sidebar name/avatar, greeting).
      router.refresh();
    },
  });

  const changePassword = useMutation({
    mutationFn: profileApi.changePassword,
    // Failed attempts are logged too.
    onSettled: refreshActivity,
  });

  const changeEmail = useMutation({ mutationFn: profileApi.changeEmail, onSuccess: refreshActivity });

  const signOutEverywhere = useMutation({ mutationFn: profileApi.signOutEverywhere, onSuccess: goToLogin });

  const deleteAccount = useMutation({ mutationFn: profileApi.deleteAccount, onSuccess: goToLogin });

  // Sample data touches every feature, so refresh every cached query.
  const refreshEverything = async () => {
    await queryClient.invalidateQueries();
    router.refresh();
  };
  const loadSampleData = useMutation({ mutationFn: profileApi.loadSampleData, onSuccess: refreshEverything });
  const removeSampleData = useMutation({ mutationFn: profileApi.removeSampleData, onSuccess: refreshEverything });

  return {
    changeEmail,
    changePassword,
    deleteAccount,
    loadSampleData,
    removeSampleData,
    signOutEverywhere,
    updateProfile,
  };
}
