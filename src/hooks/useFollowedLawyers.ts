import { useCallback, useEffect, useState } from 'react';
import apiClient from '../api/client';

export function useFollowedLawyers() {
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const follow = useCallback(async (id: string) => {
    await apiClient.followLawyer(id);
    setFollowedIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const unfollow = useCallback(async (id: string) => {
    await apiClient.unfollowLawyer(id);
    setFollowedIds((current) => current.filter((item) => item !== id));
  }, []);

  const toggleFollow = useCallback(async (id: string) => {
    if (followedIds.includes(id)) {
      await apiClient.unfollowLawyer(id);
      setFollowedIds((current) => current.filter((item) => item !== id));
      return;
    }

    await apiClient.followLawyer(id);
    setFollowedIds((current) => [...current, id]);
  }, [followedIds]);

  return {
    followedIds,
    isFollowed,
    follow,
    unfollow,
    toggleFollow,
    totalFollowed: followedIds.length,
    isLoading,
    reload: loadFollowing,
  };
}
