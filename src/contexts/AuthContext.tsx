'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    profile: any | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createBrowserSupabaseClient();

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('perfis')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                return null;
            }
            return data;
        } catch (err) {
            console.error('Profile fetch error:', err);
            return null;
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                const p = await fetchProfile(session.user.id);
                setProfile(p);
            }
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            // [CRÍTICO] Limpar perfil imediatamente ao detectar mudança de estado
            // Isso evita que o perfil do usuário anterior (Master) vaze para o novo
            setProfile(null);
            setUser(session?.user ?? null);

            if (session?.user) {
                setLoading(true);
                const p = await fetchProfile(session.user.id);
                setProfile(p);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    const signOut = async () => {
        await supabase.auth.signOut();
        // Limpar estados locais de persistência para evitar vazamento entre logins
        localStorage.removeItem('@megamais/loja_id');
        setProfile(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
