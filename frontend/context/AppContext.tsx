import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  points: number;
  tier: string;
}

export interface CartItem {
  item_id: string;
  name: string;
  size: string;
  quantity: number;
  price: float;
  image_url: string;
}

interface AppContextType {
  user: User | null;
  setUser: (u: User | null) => void;
  sessionToken: string | null;
  setSessionToken: (t: string | null) => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  cartTotal: number;
  isLoading: boolean;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  authHeaders: () => Record<string, string>;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (token) {
        setSessionToken(token);
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          await AsyncStorage.removeItem('session_token');
          setSessionToken(null);
        }
      }
    } catch (e) {
      console.log('Session load error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUser = async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        setUser(await res.json());
      }
    } catch (e) {
      console.log('Fetch user error', e);
    }
  };

  const authHeaders = () => {
    if (!sessionToken) return { 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` };
  };

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item_id === item.item_id && c.size === item.size);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + item.quantity };
        return updated;
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch (e) {}
    await AsyncStorage.removeItem('session_token');
    setSessionToken(null);
    setUser(null);
    setCart([]);
  };

  return (
    <AppContext.Provider
      value={{ user, setUser, sessionToken, setSessionToken, cart, addToCart, removeFromCart, clearCart, cartTotal, isLoading, logout, fetchUser, authHeaders }}
    >
      {children}
    </AppContext.Provider>
  );
}
