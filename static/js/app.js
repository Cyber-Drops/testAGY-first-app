/**
 * BigQuery Release Notes Viewer - Frontend Controller
 */

// Application State
const state = {
  data: null,
  selectedItem: null,
  activeFilter: 'ALL',
  searchQuery: '',
  isLoading: false,
};

// DOM Elements
const elements = {
  refreshBtn: document.getElementById('refreshBtn'),
  refreshBtnText: document.getElementById('refreshBtnText'),
  refreshIcon: document.querySelector('.refresh-icon'),
  liveDot: document.getElementById('liveDot'),
  statusSummary: document.getElementById('statusSummary'),
  lastUpdatedLabel: document.getElementById('lastUpdatedLabel'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  categoryFilters: document.getElementById('categoryFilters'),
  countAll: document.getElementById('countAll'),
  countFeature: document.getElementById('countFeature'),
  countChange: document.getElementById('countChange'),
  countOther: document.getElementById('countOther'),
  errorBox: document.getElementById('errorBox'),
  errorMessage: document.getElementById('errorMessage'),
  retryBtn: document.getElementById('retryBtn'),
  selectionBanner: document.getElementById('selectionBanner'),
  selectionSnippet: document.getElementById('selectionSnippet'),
  shareTwitterDirectBtn: document.getElementById('shareTwitterDirectBtn'),
  previewTweetBtn: document.getElementById('previewTweetBtn'),
  clearSelectionBtn: document.getElementById('clearSelectionBtn'),
  releasesContainer: document.getElementById('releasesContainer'),
  emptyState: document.getElementById('emptyState'),
  resetFilterBtn: document.getElementById('resetFilterBtn'),
  // Modal Elements
  tweetModal: document.getElementById('tweetModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  tweetTextarea: document.getElementById('tweetTextarea'),
  charCounter: document.getElementById('charCounter'),
  charWarning: document.getElementById('charWarning'),
  tweetPreviewLink: document.getElementById('tweetPreviewLink'),
  copyTweetBtn: document.getElementById('copyTweetBtn'),
  copyBtnText: document.getElementById('copyBtnText'),
  openTwitterBtn: document.getElementById('openTwitterBtn'),
  toast: document.getElementById('toast'),
};

/**
 * Initialize application
 */
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadReleases(false);
});

/**
 * Event Listeners Setup
 */
function setupEventListeners() {
  // Refresh button
  elements.refreshBtn.addEventListener('click', () => {
    loadReleases(true);
  });

  // Retry button
  elements.retryBtn.addEventListener('click', () => {
    loadReleases(true);
  });

  // Search input
  let searchTimeout = null;
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    elements.clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      renderReleases();
    }, 200);
  });

  // Clear search button
  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.clearSearchBtn.style.display = 'none';
    state.searchQuery = '';
    renderReleases();
  });

  // Category filter pills
  elements.categoryFilters.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;

    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    pill.classList.add('active');
    state.activeFilter = pill.getAttribute('data-type');
    renderReleases();
  });

  // Reset filters from empty state
  elements.resetFilterBtn.addEventListener('click', () => {
    state.searchQuery = '';
    elements.searchInput.value = '';
    elements.clearSearchBtn.style.display = 'none';
    state.activeFilter = 'ALL';
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-type') === 'ALL');
    });
    renderReleases();
  });

  // Selection banner actions
  elements.clearSelectionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelection();
  });

  elements.shareTwitterDirectBtn.addEventListener('click', () => {
    if (!state.selectedItem) return;
    openTwitterShare(state.selectedItem);
  });

  elements.previewTweetBtn.addEventListener('click', () => {
    if (!state.selectedItem) return;
    openTweetModal(state.selectedItem);
  });

  // Modal actions
  elements.closeModalBtn.addEventListener('click', closeTweetModal);
  elements.tweetModal.addEventListener('click', (e) => {
    if (e.target === elements.tweetModal) closeTweetModal();
  });

  elements.tweetTextarea.addEventListener('input', () => {
    updateCharCounter();
  });

  elements.copyTweetBtn.addEventListener('click', () => {
    const fullText = buildFullTweetWithUrl(elements.tweetTextarea.value, elements.tweetPreviewLink.href);
    navigator.clipboard.writeText(fullText).then(() => {
      showToast('Messaggio copiato negli appunti!');
      elements.copyBtnText.textContent = 'Copiato!';
      setTimeout(() => {
        elements.copyBtnText.textContent = 'Copia Testo';
      }, 2000);
    }).catch(() => {
      showToast('Impossibile copiare negli appunti');
    });
  });

  elements.openTwitterBtn.addEventListener('click', () => {
    const customText = elements.tweetTextarea.value.trim();
    const url = elements.tweetPreviewLink.href;
    executeTwitterIntent(customText, url);
  });

  // Keyboard shortcut Esc to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.tweetModal.style.display !== 'none') {
      closeTweetModal();
    }
  });
}

/**
 * Fetch releases from backend
 */
async function loadReleases(forceRefresh = false) {
  if (state.isLoading) return;
  setLoading(true);
  hideError();

  try {
    const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    const result = await res.json();

    if (!res.ok || result.status !== 'success') {
      throw new Error(result.message || 'Errore nel recupero delle note di rilascio');
    }

    state.data = result.data;
    updateStatusMeta(result.data, forceRefresh);
    updateCategoryCounts(result.data.items || []);
    renderReleases();

    if (forceRefresh) {
      showToast('Note di rilascio aggiornate con successo!');
    }
  } catch (err) {
    console.error('Fetch error:', err);
    showError(err.message || 'Si è verificato un errore di connessione.');
  } finally {
    setLoading(false);
  }
}

/**
 * Update UI loading state
 */
function setLoading(loading) {
  state.isLoading = loading;
  if (loading) {
    elements.refreshBtn.disabled = true;
    elements.refreshBtnText.textContent = 'Aggiornamento...';
    elements.refreshIcon.classList.add('spinning');
    elements.liveDot.className = 'status-indicator loading';
    elements.statusSummary.textContent = 'Download feed BigQuery in corso...';
  } else {
    elements.refreshBtn.disabled = false;
    elements.refreshBtnText.textContent = 'Aggiorna Feed';
    elements.refreshIcon.classList.remove('spinning');
    elements.liveDot.className = 'status-indicator live';
  }
}

/**
 * Update header status bar metadata
 */
function updateStatusMeta(data, wasRefreshed) {
  const count = data.total_items_count || (data.items ? data.items.length : 0);
  elements.statusSummary.textContent = `${count} aggiornamenti disponibili da ${data.entries_count || 0} date di rilascio.`;
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  elements.lastUpdatedLabel.textContent = `Ultimo aggiornamento: ${timeStr}`;
}

/**
 * Update category counter badges
 */
function updateCategoryCounts(items) {
  let countFeature = 0;
  let countChange = 0;
  let countOther = 0;

  items.forEach(item => {
    const t = (item.type || '').toLowerCase();
    if (t.includes('feature')) {
      countFeature++;
    } else if (t.includes('change')) {
      countChange++;
    } else {
      countOther++;
    }
  });

  elements.countAll.textContent = items.length;
  elements.countFeature.textContent = countFeature;
  elements.countChange.textContent = countChange;
  elements.countOther.textContent = countOther;
}

/**
 * Render release notes grouped by date
 */
function renderReleases() {
  if (!state.data || !state.data.entries) {
    return;
  }

  const query = state.searchQuery;
  const filter = state.activeFilter;
  let totalVisibleItems = 0;

  // Clear current list
  elements.releasesContainer.innerHTML = '';

  state.data.entries.forEach(entry => {
    // Filter entry items
    const filteredItems = (entry.items || []).filter(item => {
      // Category filter
      const itemType = (item.type || '').toLowerCase();
      if (filter === 'Feature' && !itemType.includes('feature')) return false;
      if (filter === 'Change' && !itemType.includes('change')) return false;
      if (filter === 'Other' && (itemType.includes('feature') || itemType.includes('change'))) return false;

      // Search filter
      if (query) {
        const textToSearch = `${item.date} ${item.type} ${item.plain_text}`.toLowerCase();
        if (!textToSearch.includes(query)) return false;
      }
      return true;
    });

    if (filteredItems.length === 0) {
      return;
    }

    totalVisibleItems += filteredItems.length;

    // Create Date Group Container
    const dateGroup = document.createElement('div');
    dateGroup.className = 'date-group';

    // Date header
    const dateHeader = document.createElement('div');
    dateHeader.className = 'date-header';
    dateHeader.innerHTML = `
      <svg class="date-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <h2 class="date-title">${escapeHtml(entry.title || 'Aggiornamento')}</h2>
      <span class="date-badge">${filteredItems.length} novit${filteredItems.length === 1 ? 'à' : 'à'}</span>
    `;
    dateGroup.appendChild(dateHeader);

    // Cards list
    const cardsList = document.createElement('div');
    cardsList.className = 'cards-list';

    filteredItems.forEach(item => {
      const card = createReleaseCard(item);
      cardsList.appendChild(card);
    });

    dateGroup.appendChild(cardsList);
    elements.releasesContainer.appendChild(dateGroup);
  });

  // Empty state handling
  if (totalVisibleItems === 0) {
    elements.emptyState.style.display = 'block';
  } else {
    elements.emptyState.style.display = 'none';
  }

  // Update selection banner state
  updateSelectionUI();
}

/**
 * Create a single Release Card element
 */
function createReleaseCard(item) {
  const card = document.createElement('article');
  card.className = 'release-card';
  card.id = `card-${item.id}`;

  if (state.selectedItem && state.selectedItem.id === item.id) {
    card.classList.add('selected');
  }

  const rawType = item.type || 'Update';
  let badgeClass = 'other';
  if (rawType.toLowerCase().includes('feature')) badgeClass = 'feature';
  else if (rawType.toLowerCase().includes('change')) badgeClass = 'change';

  card.innerHTML = `
    <div class="card-top">
      <div class="tag-badge ${badgeClass}">
        ${escapeHtml(rawType)}
      </div>
      <div class="card-select-trigger" title="Seleziona questo aggiornamento">
        <span class="custom-radio"></span>
        <span class="select-label">${state.selectedItem && state.selectedItem.id === item.id ? 'Selezionato' : 'Seleziona'}</span>
      </div>
    </div>

    <div class="card-body">
      ${item.html || `<p>${escapeHtml(item.plain_text)}</p>`}
    </div>

    <div class="card-footer">
      <div class="footer-left">
        ${item.link ? `
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="doc-link" title="Apri sezione documentazione Google Cloud">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Vedi nei docs ufficiali
          </a>
        ` : ''}
      </div>

      <div class="card-actions">
        <button class="btn btn-outline btn-card-action btn-preview-card" title="Personalizza e condividi su Twitter">
          Anteprima
        </button>
        <button class="btn btn-twitter btn-card-action btn-share-card" title="Condividi direttamente su Twitter">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          Condividi
        </button>
      </div>
    </div>
  `;

  // Click card to select/toggle
  card.addEventListener('click', (e) => {
    // If user clicked a direct link or button inside the card, do not toggle selection unintentionally
    if (e.target.closest('a') || e.target.closest('.btn-card-action')) {
      return;
    }
    toggleItemSelection(item);
  });

  // Action: Direct share button on card
  const shareBtn = card.querySelector('.btn-share-card');
  shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectItem(item);
    openTwitterShare(item);
  });

  // Action: Preview button on card
  const previewBtn = card.querySelector('.btn-preview-card');
  previewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectItem(item);
    openTweetModal(item);
  });

  return card;
}

/**
 * Selection handlers
 */
function toggleItemSelection(item) {
  if (state.selectedItem && state.selectedItem.id === item.id) {
    clearSelection();
  } else {
    selectItem(item);
  }
}

function selectItem(item) {
  state.selectedItem = item;
  updateSelectionUI();
}

function clearSelection() {
  state.selectedItem = null;
  updateSelectionUI();
}

function updateSelectionUI() {
  // Update card elements classes
  document.querySelectorAll('.release-card').forEach(card => {
    const isSelected = state.selectedItem && card.id === `card-${state.selectedItem.id}`;
    card.classList.toggle('selected', isSelected);
    const label = card.querySelector('.select-label');
    if (label) {
      label.textContent = isSelected ? 'Selezionato' : 'Seleziona';
    }
  });

  // Update floating banner
  if (state.selectedItem) {
    elements.selectionBanner.style.display = 'flex';
    const cleanSnippet = truncateText(state.selectedItem.plain_text, 140);
    elements.selectionSnippet.textContent = `${state.selectedItem.date} [${state.selectedItem.type}]: ${cleanSnippet}`;
  } else {
    elements.selectionBanner.style.display = 'none';
  }
}

/**
 * Generate formatted tweet text from item
 */
function generateTweetText(item) {
  const typeEmoji = (item.type || '').toLowerCase().includes('feature') ? '🚀' : '✨';
  const prefix = `${typeEmoji} Google BigQuery (${item.date}): `;
  const hashtags = ' #BigQuery #GoogleCloud';
  
  // Calculate remaining characters for description
  // Twitter URL counts as ~23 chars, hashtags count as ~24 chars
  const availableChars = 280 - prefix.length - hashtags.length - 25;
  const snippet = truncateText(item.plain_text, Math.max(availableChars, 80));

  return `${prefix}${snippet}${hashtags}`;
}

function buildFullTweetWithUrl(text, url) {
  if (url) {
    return `${text}\n${url}`;
  }
  return text;
}

/**
 * Open Twitter Share Intent directly
 */
function openTwitterShare(item) {
  const tweetText = generateTweetText(item);
  const docUrl = item.link || 'https://cloud.google.com/bigquery/docs/release-notes';
  executeTwitterIntent(tweetText, docUrl);
}

/**
 * Open popup window with Twitter Web Intent
 */
function executeTwitterIntent(text, url) {
  const params = new URLSearchParams();
  params.set('text', text);
  if (url) {
    params.set('url', url);
  }

  const intentUrl = `https://twitter.com/intent/tweet?${params.toString()}`;
  const width = 600;
  const height = 480;
  const left = Math.max(0, (window.screen.width - width) / 2);
  const top = Math.max(0, (window.screen.height - height) / 2);

  window.open(
    intentUrl,
    'share_twitter',
    `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
  );
}

/**
 * Modal Tweet Customizer
 */
function openTweetModal(item) {
  const defaultText = generateTweetText(item);
  elements.tweetTextarea.value = defaultText;
  elements.tweetPreviewLink.href = item.link || 'https://cloud.google.com/bigquery/docs/release-notes';
  elements.tweetPreviewLink.textContent = item.link || 'https://cloud.google.com/bigquery/docs/release-notes';

  updateCharCounter();
  elements.tweetModal.style.display = 'flex';
  elements.tweetTextarea.focus();
}

function closeTweetModal() {
  elements.tweetModal.style.display = 'none';
}

function updateCharCounter() {
  const length = elements.tweetTextarea.value.length;
  // Estimated with 23 char link
  const totalLength = length + 24;
  elements.charCounter.textContent = `${totalLength} / 280 caratteri`;

  if (totalLength > 280) {
    elements.charCounter.style.color = '#ea4335';
    elements.charWarning.style.display = 'inline';
  } else {
    elements.charCounter.style.color = '#5f6368';
    elements.charWarning.style.display = 'none';
  }
}

/**
 * Show error box
 */
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorBox.style.display = 'flex';
}

function hideError() {
  elements.errorBox.style.display = 'none';
}

/**
 * Toast Notification Helper
 */
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.style.display = 'block';
  setTimeout(() => {
    elements.toast.style.display = 'none';
  }, 2800);
}

/**
 * Helper: Truncate string gracefully
 */
function truncateText(str, maxLength) {
  if (!str) return '';
  const clean = str.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Helper: Basic HTML escaping
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
