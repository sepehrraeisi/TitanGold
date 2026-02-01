import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing agent favorites with localStorage persistence
 * 
 * Features:
 * - Toggle favorite status for agents
 * - Persist favorites across sessions
 * - Check if an agent is favorited
 * - Get all favorite agent IDs
 * 
 * Storage key: 'titangold_agent_favorites'
 * Storage format: JSON array of agent IDs
 * 
 * @returns Object with favorite management functions
 */

const STORAGE_KEY = 'titangold_agent_favorites';

export interface UseAgentFavoritesReturn {
  favorites: Set<string>;
  isFavorite: (agentId: string) => boolean;
  toggleFavorite: (agentId: string) => void;
  getFavoriteIds: () => string[];
}

export const useAgentFavorites = (): UseAgentFavoritesReturn => {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set<string>(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Failed to load favorites from localStorage:', error);
    }
    return new Set<string>();
  });

  // Persist to localStorage whenever favorites change
  useEffect(() => {
    try {
      const favArray = Array.from(favorites);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favArray));
    } catch (error) {
      console.error('Failed to save favorites to localStorage:', error);
    }
  }, [favorites]);

  // Check if an agent is favorited
  const isFavorite = useCallback(
    (agentId: string): boolean => {
      return favorites.has(agentId);
    },
    [favorites]
  );

  // Toggle favorite status
  const toggleFavorite = useCallback((agentId: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(agentId)) {
        newFavorites.delete(agentId);
      } else {
        newFavorites.add(agentId);
      }
      return newFavorites;
    });
  }, []);

  // Get array of favorite IDs
  const getFavoriteIds = useCallback((): string[] => {
    return Array.from(favorites);
  }, [favorites]);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    getFavoriteIds,
  };
};
