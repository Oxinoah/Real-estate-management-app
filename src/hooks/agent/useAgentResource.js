import { useCallback, useEffect, useRef, useState } from 'react';

export function useAgentResource(load, dependencies) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    // Never leave stale data actionable after a failed refresh or reassignment.
    setState({ data: null, loading: true, error: null });
    try {
      const data = await load();
      if (request.current === current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (request.current === current) setState({ data: null, loading: false, error: error.message });
    }
  }, dependencies);
  useEffect(() => {
    refresh();
    return () => { request.current += 1; };
  }, [refresh]);
  return { ...state, refresh };
}

export function useAgentAction(onChanged) {
  const [state, setState] = useState({ busy: false, error: null, success: null });
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  async function run(action, success) {
    if (running.current) return false;
    running.current = true;
    setState({ busy: true, error: null, success: null });
    try {
      await action();
      if (mounted.current) {
        setState({ busy: false, error: null, success });
      }
      onChanged?.(success);
      return true;
    } catch (error) {
      if (mounted.current) setState({ busy: false, error: error.message, success: null });
      return false;
    } finally {
      running.current = false;
    }
  }
  return { ...state, run };
}
