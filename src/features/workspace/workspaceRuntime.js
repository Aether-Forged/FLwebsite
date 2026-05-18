import { supabase } from '../../lib/supabaseClient';

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

function emit() {
  for (const listener of subscribers) {
    listener(readiness);
  }
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
  emit();
  return readiness;
}

function runtimeFailure(code, message, recoverable, nextAction, safeUiState) {
  const failure = {
    code,
    message,
    recoverable,
    nextAction,
    safeUiState,
    timestamp: new Date().toISOString(),
  };

  readiness = {
    ...readiness,
    errors: [...readiness.errors, failure],
    lastErrorCode: code,
  };

  transition(recoverable ? 'runtime_degraded' : 'runtime_error', {
    mcp: {
      ...readiness.mcp,
      available: readiness.mcp.available,
      failureReason: message,
      initializationStatus: recoverable ? 'degraded' : 'failed',
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
  readiness = {
    ...readiness,
    ...patch,
  };
  emit();
  return readiness;
}

async function loadWorkspaceForSession(session) {
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

  return readiness;
}

export function initializeWorkspaceRuntime() {
  if (readiness.status !== 'unauthenticated' || readiness.session) {
    return Promise.resolve(readiness);
  }

  transition('authenticating', {
    supabase: {
      ...readiness.supabase,
      connected: Boolean(supabase),
      lastChecked: new Date().toISOString(),
      status: supabase ? 'ready' : 'unavailable',
    },
  });

  return Promise.resolve()
    .then(async () => {
      if (!supabase) {
        return loadWorkspaceForSession(null);
      }

      const { data } = await supabase.auth.getSession();
      const nextSession = data.session ?? null;
      setWorkspaceState({
        session: nextSession,
        userId: nextSession?.user?.id ?? null,
        permissions: nextSession?.user?.app_metadata?.roles ?? [],
      });
      if (!nextSession) {
        return loadWorkspaceForSession(null);
      }
      transition('auth_ready', {
        session: nextSession,
        userId: nextSession.user?.id ?? null,
        permissions: nextSession.user?.app_metadata?.roles ?? [],
      });
      return loadWorkspaceForSession(nextSession);
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
    });
}

export function refreshWorkspaceRuntime() {
  readiness = {
    ...readiness,
    workspaceRefreshTick: readiness.workspaceRefreshTick + 1,
  };
  emit();
  return loadWorkspaceForSession(readiness.session);
}

export function getWorkspaceReadiness() {
  return readiness;
}

export function subscribeWorkspaceRuntime(listener) {
  subscribers.add(listener);
  listener(readiness);
  return () => subscribers.delete(listener);
}

export async function signIn({ email, password }) {
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

  return loadWorkspaceForSession(nextSession);
}

export async function signOut() {
  if (!supabase) {
    return readiness;
  }

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
    ...defaultReadiness,
    supabase: {
      ...defaultReadiness.supabase,
      connected: Boolean(supabase),
      lastChecked: new Date().toISOString(),
      status: supabase ? 'ready' : 'unavailable',
    },
  });
}
