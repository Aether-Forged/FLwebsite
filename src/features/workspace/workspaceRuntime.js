import { supabase } from '../../lib/supabaseClient';

const RUNTIME_INIT_TIMEOUT_MS = 15000;

const defaultWorkspaceCards = [
  {
    badge: 'Overview',
    title: 'Session map',
    body: 'A private launch surface for the current site session and the next places to go.',
    note: 'Use this as the home base after authentication.',
  },
  {
    badge: 'Modules',
    title: 'Project areas',
    body: 'Drop in product pages, tools, notes, or build zones as selectable modules.',
    note: 'Each card can become a live module as the site grows.',
  },
  {
    badge: 'Status',
    title: 'Deployment',
    body: 'GitHub Pages serves the app and keeps the current build online.',
    note: 'Pushes to main update the live URL automatically.',
  },
  {
    badge: 'Data',
    title: 'Supabase feed',
    body: 'Workspace cards are loaded from Supabase when the table is ready.',
    note: 'The page falls back to these defaults if the table is empty.',
  },
];

const defaultReadiness = {
  status: 'unauthenticated',
  userId: null,
  workspaceId: null,
  permissions: [],
  supabase: {
    connected: Boolean(supabase),
    lastChecked: null,
    status: supabase ? 'ready' : 'unavailable',
  },
  github: {
    available: true,
    repo: import.meta.env.VITE_GITHUB_REPO || 'Aether-Forged/FLwebsite',
    scope: 'workspace',
    status: 'available',
  },
  mcp: {
    available: false,
    capabilities: [
      'inspectWorkspace',
      'listWorkspaceFiles',
      'readWorkspaceFile',
      'reportBoundary',
      'reportAvailability',
    ],
    scope: 'workspace',
    initializationStatus: 'unavailable',
    failureReason: 'MCP bridge not initialized in browser runtime.',
  },
  errors: [],
  lastTransition: 'unauthenticated',
  lastErrorCode: null,
  session: null,
  workspaceCards: defaultWorkspaceCards,
  workspaceStatus: 'Workspace table not loaded yet.',
  workspaceActivity: 'Choose a module action to update the workspace.',
  activeModuleId: defaultWorkspaceCards[0].title,
  workspaceRefreshTick: 0,
};

let readiness = structuredClone(defaultReadiness);
const subscribers = new Set();
const runtimeHost = globalThis.__workspaceRuntimeHost ??= {
  initialized: false,
  authListenerAttached: false,
  authSubscription: null,
  bootPromise: null,
  initTimeoutId: null,
  generation: 0,
  currentReadiness: readiness,
  subscribers,
};

function emit() {
  runtimeHost.currentReadiness = readiness;
  for (const listener of subscribers) {
    listener(readiness);
  }
}

function clearRuntimeInitTimeout() {
  if (typeof window === 'undefined') {
    return;
  }
  if (runtimeHost.initTimeoutId) {
    window.clearTimeout(runtimeHost.initTimeoutId);
    runtimeHost.initTimeoutId = null;
  }
}

function scheduleRuntimeInitTimeout() {
  if (typeof window === 'undefined') {
    return;
  }
  clearRuntimeInitTimeout();

  runtimeHost.initTimeoutId = window.setTimeout(() => {
    const activeStatuses = new Set([
      'runtime_ready',
      'runtime_error',
      'runtime_degraded',
      'unauthenticated',
    ]);

    if (activeStatuses.has(readiness.status)) {
      clearRuntimeInitTimeout();
      return;
    }

    runtimeFailure(
      'RUNTIME_TIMEOUT',
      'Workspace runtime initialization timed out.',
      true,
      'Retry initialization or refresh the page.',
      'workspace_degraded',
    );
    clearRuntimeInitTimeout();
  }, RUNTIME_INIT_TIMEOUT_MS);
}

function transition(nextStatus, patch = {}) {
  const keepsErrorCode = nextStatus === 'runtime_error' || nextStatus === 'runtime_degraded';
  readiness = {
    ...readiness,
    ...patch,
    status: nextStatus,
    lastTransition: nextStatus,
    lastErrorCode: keepsErrorCode ? readiness.lastErrorCode : patch.lastErrorCode ?? null,
  };
  console.log(`[RUNTIME] ${nextStatus}`);
  if (
    nextStatus === 'runtime_ready' ||
    nextStatus === 'runtime_error' ||
    nextStatus === 'runtime_degraded' ||
    nextStatus === 'unauthenticated'
  ) {
    clearRuntimeInitTimeout();
  }
  emit();
  return readiness;
}

function patchReadiness(patch = {}) {
  readiness = {
    ...readiness,
    ...patch,
  };
  emit();
  return readiness;
}

function bumpGeneration() {
  runtimeHost.generation += 1;
  return runtimeHost.generation;
}

function isStaleGeneration(capturedGeneration) {
  return capturedGeneration !== runtimeHost.generation;
}

function ignoreStaleResult() {
  console.log('[RUNTIME] stale_result_ignored');
}

function runtimeFailure(code, message, recoverable, nextAction, safeUiState, blocking = false) {
  const failure = {
    code,
    message,
    recoverable,
    nextAction,
    safeUiState,
    blocking,
    timestamp: new Date().toISOString(),
  };

  const lastFailure = readiness.errors[readiness.errors.length - 1];
  const errors = lastFailure?.code === code ? [...readiness.errors.slice(0, -1), failure] : [...readiness.errors, failure];

  readiness = {
    ...readiness,
    errors,
    lastErrorCode: code,
  };

  transition(blocking ? 'runtime_error' : recoverable ? 'runtime_degraded' : 'runtime_error', {
    mcp: {
      ...readiness.mcp,
      available: readiness.mcp.available,
      failureReason: message,
      initializationStatus: blocking ? 'failed' : recoverable ? 'degraded' : 'failed',
    },
  });

  return failure;
}

function normalizeWorkspaceCard(card, index) {
  const fallback = defaultWorkspaceCards[index] ?? defaultWorkspaceCards[0];
  return {
    badge: card?.badge || fallback.badge,
    title: card?.title || fallback.title,
    body: card?.body || fallback.body,
    note: card?.note || fallback.note,
    status: card?.status,
    summary: card?.summary,
    actions: card?.actions,
    index: card?.index,
  };
}

function setWorkspaceState(patch = {}) {
  return patchReadiness(patch);
}

async function loadWorkspaceForSession(session, capturedGeneration = runtimeHost.generation) {
  if (isStaleGeneration(capturedGeneration)) {
    ignoreStaleResult();
    return readiness;
  }

  if (!supabase) {
    transition('runtime_degraded', {
      supabase: {
        ...readiness.supabase,
        connected: false,
        lastChecked: new Date().toISOString(),
        status: 'unavailable',
      },
      workspaceCards: defaultWorkspaceCards,
      workspaceStatus: 'Supabase is not configured yet.',
      workspaceActivity: 'Login to load live workspace cards.',
    });
    return readiness;
  }

  if (!session?.user?.email) {
    transition('unauthenticated', {
      session: null,
      workspaceCards: defaultWorkspaceCards,
      workspaceStatus: 'Login required.',
      workspaceActivity: 'Login to load live workspace cards.',
      activeModuleId: defaultWorkspaceCards[0].title,
      supabase: {
        ...readiness.supabase,
        connected: true,
        lastChecked: new Date().toISOString(),
        status: 'ready',
      },
    });
    return readiness;
  }

  transition('resolving_workspace', {
    session,
    supabase: {
      ...readiness.supabase,
      connected: true,
      lastChecked: new Date().toISOString(),
      status: 'ready',
    },
  });

  try {
    const { data: cards, error: cardsError } = await supabase
      .from('workspace_cards')
      .select('id, title, body, note, badge, order_index, is_active')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (isStaleGeneration(capturedGeneration)) {
      ignoreStaleResult();
      return readiness;
    }

    if (cardsError) {
      runtimeFailure(
        'SUPABASE_QUERY_FAILED',
        `Using fallback cards because the workspace table is not ready: ${cardsError.message}`,
        true,
        'Review the workspace_cards query and policy state.',
        'workspace_degraded',
      );
      return setWorkspaceState({
        status: 'runtime_degraded',
        workspaceCards: defaultWorkspaceCards,
        workspaceStatus: `Using fallback cards because the workspace table is not ready: ${cardsError.message}`,
        workspaceActivity: 'Login to load live workspace cards.',
        activeModuleId: defaultWorkspaceCards[0].title,
      });
    }

    if (cards?.length) {
      const normalizedCards = cards.map((card, index) => normalizeWorkspaceCard(card, index));
      transition('workspace_loaded', {
        session,
        workspaceCards: normalizedCards,
        workspaceStatus: `Loaded ${cards.length} workspace card${cards.length === 1 ? '' : 's'} from Supabase.`,
        workspaceActivity: 'Workspace cards loaded from Supabase.',
        activeModuleId: normalizedCards[0].title,
      });
    } else {
      transition('workspace_loaded', {
        session,
        workspaceCards: defaultWorkspaceCards,
        workspaceStatus: 'Workspace table is connected, but no cards have been added yet.',
        workspaceActivity: 'Workspace table is connected but empty.',
        activeModuleId: defaultWorkspaceCards[0].title,
      });
    }
  } catch (error) {
    if (isStaleGeneration(capturedGeneration)) {
      ignoreStaleResult();
      return readiness;
    }

    runtimeFailure(
      'SUPABASE_QUERY_FAILED',
      `Workspace load failed: ${error?.message || 'Unknown error'}`,
      true,
      'Retry the workspace load.',
      'workspace_degraded',
    );
    return setWorkspaceState({
      status: 'runtime_degraded',
      session,
      workspaceCards: defaultWorkspaceCards,
      workspaceStatus: `Workspace load failed: ${error?.message || 'Unknown error'}`,
      workspaceActivity: 'Login to load live workspace cards.',
      activeModuleId: defaultWorkspaceCards[0].title,
    });
  }

  if (isStaleGeneration(capturedGeneration)) {
    ignoreStaleResult();
    return readiness;
  }

  transition('hydrating_runtime', {
    session,
  });

  transition('mcp_initializing', {
    mcp: {
      ...readiness.mcp,
      available: false,
      initializationStatus: 'unavailable',
      failureReason: 'MCP bridge not initialized in browser runtime.',
    },
  });

  transition('runtime_ready', {
    session,
  });

  clearRuntimeInitTimeout();
  return readiness;
}

export function initializeWorkspaceRuntime() {
  const capturedGeneration = bumpGeneration();
  if (runtimeHost.bootPromise) {
    return runtimeHost.bootPromise;
  }
  runtimeHost.initialized = true;
  scheduleRuntimeInitTimeout();

  transition('authenticating', {
    supabase: {
      ...readiness.supabase,
      connected: Boolean(supabase),
      lastChecked: new Date().toISOString(),
      status: supabase ? 'ready' : 'unavailable',
    },
  });

  runtimeHost.bootPromise = Promise.resolve()
    .then(async () => {
      if (!supabase) {
        return loadWorkspaceForSession(null, capturedGeneration);
      }

      const { data } = await supabase.auth.getSession();
      const nextSession = data.session ?? null;
      setWorkspaceState({
        session: nextSession,
        userId: nextSession?.user?.id ?? null,
        permissions: nextSession?.user?.app_metadata?.roles ?? [],
      });
      if (!nextSession) {
        return loadWorkspaceForSession(null, capturedGeneration);
      }
      transition('auth_ready', {
        session: nextSession,
        userId: nextSession.user?.id ?? null,
        permissions: nextSession.user?.app_metadata?.roles ?? [],
      });
      return loadWorkspaceForSession(nextSession, capturedGeneration);
    })
    .catch((error) => {
      runtimeFailure(
        'SESSION_INVALID',
        error?.message || 'Failed to initialize workspace session.',
        true,
        'Re-authenticate the current account.',
        'login_required',
      );
      return readiness;
    })
    .finally(() => {
      runtimeHost.bootPromise = null;
    });

  if (supabase && !runtimeHost.authListenerAttached) {
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setWorkspaceState({
        session: nextSession ?? null,
        userId: nextSession?.user?.id ?? null,
        permissions: nextSession?.user?.app_metadata?.roles ?? [],
      });

      if (event === 'SIGNED_OUT') {
        bumpGeneration();
        runtimeHost.bootPromise = null;
        clearRuntimeInitTimeout();
        readiness = {
          ...defaultReadiness,
          supabase: {
            ...defaultReadiness.supabase,
            connected: Boolean(supabase),
            lastChecked: new Date().toISOString(),
            status: supabase ? 'ready' : 'unavailable',
          },
        };
        console.log('[RUNTIME] unauthenticated');
        emit();
        return;
      }

      if (nextSession?.user?.email) {
        void loadWorkspaceForSession(nextSession, runtimeHost.generation);
      }
    });

    runtimeHost.authListenerAttached = true;
    runtimeHost.authSubscription = data.subscription;
  }

  return runtimeHost.bootPromise;
}

export function refreshWorkspaceRuntime() {
  const capturedGeneration = bumpGeneration();
  readiness = {
    ...readiness,
    workspaceRefreshTick: readiness.workspaceRefreshTick + 1,
  };
  emit();
  return loadWorkspaceForSession(readiness.session, capturedGeneration);
}

export function getWorkspaceReadiness() {
  return readiness;
}

export function subscribeWorkspaceRuntime(listener) {
  subscribers.add(listener);
  listener(readiness);
  return () => subscribers.delete(listener);
}

export function selectWorkspaceModule(moduleTitle) {
  return patchReadiness({
    activeModuleId: moduleTitle,
  });
}

export async function signIn({ email, password }) {
  const capturedGeneration = bumpGeneration();
  if (!supabase) {
    return runtimeFailure(
      'SUPABASE_UNAVAILABLE',
      'Supabase is not configured yet. Add the .env values first.',
      true,
      'Configure Supabase and retry sign-in.',
      'login_required',
    );
  }

  transition('authenticating', {
    supabase: {
      ...readiness.supabase,
      connected: true,
      lastChecked: new Date().toISOString(),
      status: 'ready',
    },
  });

  const trimmedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

  if (error) {
    return runtimeFailure(
      'SESSION_INVALID',
      error.message,
      true,
      'Retry sign-in with valid credentials.',
      'login_required',
    );
  }

  const { data } = await supabase.auth.getSession();
  const nextSession = data.session ?? null;

  if (isStaleGeneration(capturedGeneration)) {
    ignoreStaleResult();
    return readiness;
  }

  setWorkspaceState({
    session: nextSession,
    userId: nextSession?.user?.id ?? null,
    permissions: nextSession?.user?.app_metadata?.roles ?? [],
  });

  transition('auth_ready', {
    session: nextSession,
    userId: nextSession?.user?.id ?? null,
    permissions: nextSession?.user?.app_metadata?.roles ?? [],
  });

  return loadWorkspaceForSession(nextSession, capturedGeneration);
}

export async function signOut() {
  bumpGeneration();
  if (!supabase) {
    return readiness;
  }

  clearRuntimeInitTimeout();
  const { error } = await supabase.auth.signOut();

  if (error) {
    runtimeFailure(
      'SESSION_INVALID',
      error.message,
      true,
      'Retry sign-out or refresh the session.',
      'login_required',
    );
    return readiness;
  }

  return transition('unauthenticated', {
    session: null,
    userId: null,
    workspaceId: null,
    permissions: [],
    github: {
      available: false,
      repo: null,
      scope: 'workspace',
      status: 'unavailable',
    },
    mcp: {
      ...defaultReadiness.mcp,
      available: false,
      initializationStatus: 'idle',
      failureReason: 'MCP bridge not initialized in browser runtime.',
    },
    errors: [],
    workspaceCards: defaultWorkspaceCards,
    workspaceStatus: 'Signed out.',
    workspaceActivity: 'Login to load live workspace cards.',
    activeModuleId: defaultWorkspaceCards[0].title,
    workspaceRefreshTick: 0,
    supabase: {
      ...defaultReadiness.supabase,
      connected: Boolean(supabase),
      lastChecked: new Date().toISOString(),
      status: supabase ? 'ready' : 'unavailable',
    },
  });
}
