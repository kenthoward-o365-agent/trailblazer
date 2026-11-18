import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseInactivityTimeoutOptions {
  timeoutMinutes: number;
  warningMinutes?: number;
  onTimeout: () => void;
  onWarning?: () => void;
  enabled?: boolean;
}

export const useInactivityTimeout = ({
  timeoutMinutes,
  warningMinutes = 1,
  onTimeout,
  onWarning,
  enabled = true,
}: UseInactivityTimeoutOptions) => {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    
    clearAllTimers();
    setShowWarning(false);

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = warningMinutes * 60 * 1000;
    const warningTriggerMs = timeoutMs - warningMs;

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(warningMinutes * 60);
      onWarning?.();

      // Start countdown
      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningTriggerMs);

    // Set timeout timer
    timeoutRef.current = setTimeout(async () => {
      clearAllTimers();
      setShowWarning(false);
      
      // Log the timeout event
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('security_audit_logs').insert({
            user_id: user.id,
            event_type: 'session_timeout',
            event_description: 'User session timed out due to inactivity',
          });
        }
      } catch (e) {
        console.error('Failed to log timeout event:', e);
      }
      
      onTimeout();
    }, timeoutMs);
  }, [enabled, timeoutMinutes, warningMinutes, onTimeout, onWarning, clearAllTimers]);

  const dismissWarning = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      return;
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      if (!showWarning) {
        resetTimer();
      }
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    resetTimer();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [enabled, resetTimer, clearAllTimers, showWarning]);

  return {
    showWarning,
    remainingSeconds,
    dismissWarning,
    resetTimer,
  };
};
