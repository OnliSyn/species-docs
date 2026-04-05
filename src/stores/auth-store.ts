'use client';

import { create } from 'zustand';

interface AuthState {
  // Platform auth (OAuth JWT)
  platformToken: string | null;
  platformUser: {
    id: string;
    display_name: string;
    email: string;
    role: 'operator' | 'treasury_manager' | 'user';
    avatar_url?: string;
  } | null;

  // Onli identity (Gene credential)
  onliIdentity: {
    identity_ref: string;
    vault_address: string;
    gene_verified: boolean;
  } | null;

  // Species marketplace (API key + HMAC)
  speciesApiKey: string | null;

  // Derived
  isFullyAuthenticated: () => boolean;
  canAccessSpeciesTab: () => boolean;

  // Actions
  setPlatformAuth: (token: string, user: AuthState['platformUser']) => void;
  setOnliIdentity: (identity: AuthState['onliIdentity']) => void;
  setSpeciesApiKey: (key: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  platformToken: null,
  platformUser: null,
  onliIdentity: null,
  speciesApiKey: null,

  isFullyAuthenticated: () => {
    const s = get();
    return s.platformToken !== null && s.onliIdentity !== null;
  },

  canAccessSpeciesTab: () => {
    const s = get();
    return s.platformToken !== null && s.onliIdentity !== null && s.onliIdentity.gene_verified;
  },

  setPlatformAuth: (token, user) => set({ platformToken: token, platformUser: user }),
  setOnliIdentity: (identity) => set({ onliIdentity: identity }),
  setSpeciesApiKey: (key) => set({ speciesApiKey: key }),
  logout: () => set({
    platformToken: null,
    platformUser: null,
    onliIdentity: null,
    speciesApiKey: null,
  }),
}));
