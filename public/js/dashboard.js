// public/js/dashboard.js
let appContainer = null;
let config = null;

async function initApp() {
  appContainer = document.getElementById('app');

  try {
    config = await auth.loadConfig();
  } catch (err) {
    console.error('Error cargando config:', err);
  }

  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get('token');

  if (tokenFromUrl) {
    const verified = await auth.verifyToken(tokenFromUrl);
    if (verified) {
      window.history.replaceState({}, '', '/');
      location.hash = '#/dashboard';
    } else {
      showLogin();
      return;
    }
  }

  if (!auth.isAuthenticated()) {
    showLogin();
    return;
  }

  await auth.getMe();
  showDashboard();
  router.start();
}

function showLogin() {
  const tpl = document.getElementById('tpl-login');
  appContainer.innerHTML = '';
  appContainer.appendChild(tpl.content.cloneNode(true));

  const botUsername = config?.botUsername || 'linkpulse_bot';
  const btn = document.getElementById('btn-open-telegram');
  if (btn) {
    btn.href = `https://t.me/${botUsername}`;
  }
}

function showDashboard() {
  const tpl = document.getElementById('tpl-dashboard');
  appContainer.innerHTML = '';
  appContainer.appendChild(tpl.content.cloneNode(true));

  updateUserInfo();
  setupRoutes();
  setupEventListeners();
}

function updateUserInfo() {
  if (!auth.user) return;

  const avatar = document.getElementById('user-avatar');
  const name = document.getElementById('user-name');

  if (avatar) {
    avatar.textContent = auth.user.displayName?.charAt(0).toUpperCase() || 'U';
  }
  if (name) {
    name.textContent = `@${auth.user.displayName}`;
  }
}

function setupRoutes() {
  router.register('/dashboard', renderDashboard);
  router.register('/global', renderGlobal);
  router.register('/settings', renderSettings);
  router.register('/login', () => {
    auth.logout();
    showLogin();
  });
}

async function renderDashboard() {
  switchView('dashboard');

  try {
    const sites = await api.getSites();
    const grid = document.getElementById('sites-grid');
    const empty = document.getElementById('empty-sites');

    if (sites.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';
    grid.innerHTML = '';

    for (const site of sites) {
      const card = createSiteCard(site);
      grid.appendChild(card);
    }
  } catch (err) {
    console.error('Error cargando sitios:', err);
    alert('Error al cargar sitios');
  }
}

async function renderGlobal() {
  switchView('global');

  try {
    const sites = await api.getGlobalSites(10);
    const table = document.getElementById('global-sites-table');
    const empty = document.getElementById('empty-global');

    if (sites.length === 0) {
      table.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';

    let html = '<table class="table"><thead><tr>';
    html += '<th>Sitio</th><th>URL</th><th>Dueño</th><th>Creado</th>';
    html += '</tr></thead><tbody>';

    for (const site of sites) {
      const date = new Date(site.createdAt).toLocaleDateString('es-CO');
      html += '<tr>';
      html += `<td><strong>${site.name}</strong></td>`;
      html += `<td><a href="${site.url}" target="_blank" rel="noopener">${site.url}</a></td>`;
      html += `<td>@${site.owner}</td>`;
      html += `<td>${date}</td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
    table.innerHTML = html;
  } catch (err) {
    console.error('Error cargando sitios globales:', err);
  }
}

async function renderSettings() {
  switchView('settings');

  if (!auth.user) return;

  document.getElementById('setting-display-name').textContent = auth.user.displayName;
  document.getElementById('setting-telegram-id').textContent = auth.user.telegramId;
  document.getElementById('setting-created-at').textContent = new Date(
    auth.user.createdAt
  ).toLocaleDateString('es-CO');

  try {
    const sites = await api.getSites();
    const checks = await api.getChecks(1000);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checksToday = checks.filter((c) => new Date(c.checked_at) >= today).length;

    document.getElementById('stat-total-sites').textContent = sites.length;
    document.getElementById('stat-checks-today').textContent = checksToday;
    document.getElementById('stat-open-incidents').textContent = '0';
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
  }
}

function createSiteCard(site) {
  const div = document.createElement('div');
  div.className = 'site-card';

  const statusIcon = site.current_status === 'up' ? '🟢' : '🔴';
  const visibility = site.visibility === 'global' ? '🌐 Global' : '🔒 Privado';

  div.innerHTML = `
    <div class="site-card-header">
      <span class="site-status">${statusIcon}</span>
      <h3>${site.name}</h3>
    </div>
    <a href="${site.url}" target="_blank" rel="noopener noreferrer" class="site-url">
      🔗 ${site.url}
    </a>
    <div class="site-stats">
      <div class="stat">
        <span class="stat-label">Estado</span>
        <span class="stat-value">${site.current_status?.toUpperCase() || 'N/A'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Latencia</span>
        <span class="stat-value">${site.last_latency_ms || 'N/A'}ms</span>
      </div>
      <div class="stat">
        <span class="stat-label">Uptime</span>
        <span class="stat-value">${site.uptime_pct || 'N/A'}%</span>
      </div>
    </div>
    <div class="site-footer">
      <span class="visibility-badge">${visibility}</span>
      <div class="site-actions">
        <button class="btn btn-small btn-icon" title="Eliminar">🗑</button>
      </div>
    </div>
  `;

  const deleteBtn = div.querySelector('.btn-icon');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (confirm('¿Eliminar este sitio?')) {
        try {
          await api.deleteSite(site.id);
          renderDashboard();
        } catch (err) {
          alert(`Error: ${err.message}`);
        }
      }
    });
  }

  return div;
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach((v) => {
    v.classList.remove('active');
  });

  const view = document.getElementById(`view-${viewName}`);
  if (view) {
    view.classList.add('active');
  }

  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.classList.remove('active');
  });
  document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
}

function setupEventListeners() {
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      auth.logout();
      location.hash = '#/login';
    });
  }

  const btnAddSite = document.getElementById('btn-add-site');
  const modalAddSite = document.getElementById('modal-add-site');
  const formAddSite = document.getElementById('form-add-site');

  if (btnAddSite) {
    btnAddSite.addEventListener('click', () => {
      modalAddSite.style.display = 'flex';
    });
  }

  if (formAddSite) {
    formAddSite.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-site-name').value;
      const url = document.getElementById('input-site-url').value;
      const visibility = document.querySelector('input[name="visibility"]:checked').value;

      try {
        await api.addSite(name, url, visibility);
        modalAddSite.style.display = 'none';
        formAddSite.reset();
        renderDashboard();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  document.querySelectorAll('.modal-close, .modal-close-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });
}

document.addEventListener('DOMContentLoaded', initApp);
