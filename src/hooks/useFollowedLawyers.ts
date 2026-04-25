import { useCallback, useEffect, useState } from 'react';
import apiClient from '../api/client';

export const FOLLOW_STATE_EVENT = 'lexigate:follow-state-changed';

function emitFollowState(detail: {
  lawyerId: string;
  isFollowing: boolean;
  delta: number;
  followerCount?: number;
}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FOLLOW_STATE_EVENT, { detail }));
}

export function useFollowedLawyers() {
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const loadFollowing = useCallback(async () => {
    try {
      const response = await apiClient.getFollowing();
      const nextIds = (response.data || []).map((lawyer: any) => lawyer.id);
      setFollowedIds(nextIds);
    } catch (error) {
      console.error('Failed to load followed lawyers', error);
      setFollowedIds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFollowing();
  }, [loadFollowing]);

  const isFollowed = useCallback((id: string) => followedIds.includes(id), [followedIds]);
  const isPending = useCallback((id: string) => pendingIds.includes(id), [pendingIds]);

  const follow = useCallback(async (id: string) => {
    if (pendingIds.includes(id)) return;

    setPendingIds((current) => [...current, id]);
    setFollowedIds((current) => (current.includes(id) ? current : [...current, id]));
    emitFollowState({ lawyerId: id, isFollowing: true, delta: 1 });

    try {
      const response = await apiClient.followLawyer(id);
      emitFollowState({
        lawyerId: id,
        isFollowing: true,
        delta: 0,
        followerCount: response.data?.followerCount,
      });
    } catch (error) {
      setFollowedIds((current) => current.filter((item) => item !== id));
      emitFollowState({ lawyerId: id, isFollowing: false, delta: -1 });
      console.error('Failed to follow lawyer', error);
    } finally {
      setPendingIds((current) => current.filter((item) => item !== id));
    }
  }, [pendingIds]);

  const unfollow = useCallback(async (id: string) => {
    if (pendingIds.includes(id)) return;

    setPendingIds((current) => [...current, id]);
    setFollowedIds((current) => current.filter((item) => item !== id));
    emitFollowState({ lawyerId: id, isFollowing: false, delta: -1 });

    try {
      const response = await apiClient.unfollowLawyer(id);
      emitFollowState({
        lawyerId: id,
        isFollowing: false,
        delta: 0,
        followerCount: response.data?.followerCount,
      });
    } catch (error) {
      setFollowedIds((current) => (current.includes(id) ? current : [...current, id]));
      emitFollowState({ lawyerId: id, isFollowing: true, delta: 1 });
      console.error('Failed to unfollow lawyer', error);
    } finally {
      setPendingIds((current) => current.filter((item) => item !== id));
    }
  }, [pendingIds]);

  const toggleFollow = useCallback(async (id: string) => {
    if (followedIds.includes(id)) {
      await unfollow(id);
      return;
    }

    await follow(id);
  }, [followedIds, follow, unfollow]);

  return {
    followedIds,
    isFollowed,
    isPending,
    follow,
    unfollow,
    toggleFollow,
    totalFollowed: followedIds.length,
    isLoading,
    reload: loadFollowing,
  };
}
