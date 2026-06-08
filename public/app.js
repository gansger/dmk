const state = {
  posts: [],
  gallery: [],
  knowledge: [],
  integrations: null,
  sliderSettings: null,
  dashboard: null
};

const selectors = {
  apiStatus: document.querySelector('#apiStatus'),
  metrics: document.querySelector('#metrics'),
  eventList: document.querySelector('#eventList'),
  postList: document.querySelector('#postList'),
  sliderPostList: document.querySelector('#sliderPostList'),
  galleryList: document.querySelector('#galleryList'),
  knowledgeList: document.querySelector('#knowledgeList'),
  toast: document.querySelector('#toast'),
  viewTitle: document.querySelector('#viewTitle'),
  integrationStatus: document.querySelector('#integrationStatus'),
  sliderStatus: document.querySelector('#sliderStatus'),
  galleryStatus: document.querySelector('#galleryStatus'),
  passwordStatus: document.querySelector('#passwordStatus')
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (response.status === 401) {
    window.location.href = `/admin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error('Требуется авторизация администратора.');
  }
  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload;
}

function toast(message) {
  selectors.toast.textContent = message;
  selectors.toast.classList.add('show');
  setTimeout(() => selectors.toast.classList.remove('show'), 2600);
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function tagsFromInput(value) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error || new Error('Не удалось прочитать файл.')));
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file) {
  const uploaded = await api('/api/uploads/images', {
    method: 'POST',
    body: JSON.stringify({
      data: await fileToDataUrl(file),
      name: file.name
    })
  });
  return uploaded.url;
}

function renderDashboard() {
  const totals = state.dashboard?.totals || {};
  const metrics = [
    ['Посты', totals.posts || 0],
    ['Опубликовано', totals.published || 0],
    ['Черновики', totals.drafts || 0],
    ['В слайдере', totals.slider || 0],
    ['Фото', totals.gallery || 0],
    ['Знания', totals.knowledge || 0]
  ];
  selectors.metrics.innerHTML = metrics
    .map(([label, value]) => `<article class="metric-card"><span class="muted">${label}</span><strong>${value}</strong></article>`)
    .join('');

  const events = state.dashboard?.events || [];
  selectors.eventList.innerHTML = events.length
    ? events
        .map(
          (event) => `
            <div class="event">
              <span>${escapeHtml(event.type)}</span>
              <span class="muted">${formatDate(event.createdAt)}</span>
            </div>
          `
        )
        .join('')
    : '<p class="muted">Событий пока нет.</p>';
}

function renderPosts() {
  const sortedPosts = [...state.posts].sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt)));
  selectors.postList.innerHTML = sortedPosts.length
    ? sortedPosts
        .map(
          (post) => {
            const imageCount = post.media?.filter((item) => item.type === 'image').length || 0;
            const cover = safeUrl(post.coverImage || post.media?.find((item) => item.url)?.url);
            return `
            <article class="post-item">
              <div class="item-row">
                <div class="post-summary">
                  ${cover ? `<img class="post-thumb" src="${escapeHtml(cover)}" alt="">` : ''}
                  <div>
                    <strong>${escapeHtml(post.title)}</strong>
                    <div class="muted">${formatDate(post.publishedAt || post.createdAt)}${imageCount ? ` · ${imageCount} фото` : ''}${post.videoUrl ? ' · Видео' : ''}</div>
                  </div>
                </div>
                <div class="badge-row">
                  ${post.showInSlider ? '<span class="badge slider">slider</span>' : ''}
                  <span class="badge ${post.status === 'draft' ? 'draft' : ''}">${escapeHtml(post.status)}</span>
                </div>
              </div>
              <p class="muted">${escapeHtml(post.excerpt || '')}</p>
              <div class="item-actions">
                <button class="button ghost" data-edit-post="${post.id}">Редактировать</button>
                <button class="button secondary" data-publish-post="${post.id}">Опубликовать</button>
                <button class="button ghost" data-slider-post="${post.id}">${post.showInSlider ? 'Убрать из слайдера' : 'В слайдер'}</button>
                <button class="button ghost" data-delete-post="${post.id}">Удалить</button>
              </div>
            </article>
          `;
          }
        )
        .join('')
    : '<p class="muted">Материалов пока нет.</p>';
}

function renderSliderSettings() {
  const settings = state.sliderSettings;
  if (!settings) return;

  document.querySelector('#sliderEnabled').checked = Boolean(settings.enabled);
  document.querySelector('#sliderAutoplay').checked = Boolean(settings.autoplay);
  document.querySelector('#sliderShowControls').checked = Boolean(settings.showControls);
  document.querySelector('#sliderShowDots').checked = Boolean(settings.showDots);
  document.querySelector('#sliderPauseOnHover').checked = Boolean(settings.pauseOnHover);
  document.querySelector('#sliderIntervalMs').value = settings.intervalMs;
  document.querySelector('#sliderTransitionMs').value = settings.transitionMs;
  document.querySelector('#sliderMaxItems').value = settings.maxItems;
  document.querySelector('#sliderImageFit').value = settings.imageFit || 'cover';
  document.querySelector('#sliderImagePositionX').value = settings.imagePositionX ?? 50;
  document.querySelector('#sliderImagePositionY').value = settings.imagePositionY ?? 50;
}

function renderSliderAdmin() {
  const publishedPosts = state.posts.filter((post) => post.status === 'published');
  selectors.sliderPostList.innerHTML = publishedPosts.length
    ? publishedPosts
        .sort((a, b) => Number(a.sliderOrder || 0) - Number(b.sliderOrder || 0) || String(b.publishedAt).localeCompare(String(a.publishedAt)))
        .map((post) => {
          const cover = safeUrl(post.coverImage || post.media?.find((item) => item.url)?.url);
          const imageFit = post.sliderImageFit || '';
          const imagePositionX = post.sliderImagePositionX ?? 50;
          const imagePositionY = post.sliderImagePositionY ?? 50;
          return `
            <article class="slider-admin-item">
              <div class="post-summary">
                ${cover ? `<img class="post-thumb" src="${escapeHtml(cover)}" alt="">` : ''}
                <div>
                  <strong>${escapeHtml(post.title)}</strong>
                  <div class="muted">${escapeHtml(post.slug)}</div>
                </div>
              </div>
              <div class="slider-admin-controls">
                <label class="checkline"><input type="checkbox" data-slider-toggle="${post.id}" ${post.showInSlider ? 'checked' : ''}> В слайдере</label>
                <label>
                  Порядок
                  <input type="number" value="${post.sliderOrder || 0}" data-slider-order="${post.id}">
                </label>
                <label>
                  Фото
                  <select data-slider-image-fit="${post.id}">
                    <option value="" ${imageFit === '' ? 'selected' : ''}>Как в настройках</option>
                    <option value="cover" ${imageFit === 'cover' ? 'selected' : ''}>Заполнить</option>
                    <option value="contain" ${imageFit === 'contain' ? 'selected' : ''}>Целиком</option>
                  </select>
                </label>
                <label>
                  Фото X, %
                  <input type="number" min="0" max="100" step="1" value="${imagePositionX}" data-slider-image-x="${post.id}">
                </label>
                <label>
                  Фото Y, %
                  <input type="number" min="0" max="100" step="1" value="${imagePositionY}" data-slider-image-y="${post.id}">
                </label>
                <button class="button ghost" type="button" data-save-slider-post="${post.id}">Сохранить</button>
              </div>
            </article>
          `;
        })
        .join('')
    : '<p class="muted">Опубликованных постов пока нет.</p>';
}

function renderGalleryAdmin() {
  const items = [...state.gallery].sort(
    (a, b) =>
      Number(a.order || 0) - Number(b.order || 0) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
  selectors.galleryList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="gallery-admin-item">
              <div class="item-row">
                <div class="post-summary">
                  <img class="gallery-admin-thumb" src="${escapeHtml(safeUrl(item.url))}" alt="">
                  <div>
                    <strong>${escapeHtml(item.caption || 'Фото без подписи')}</strong>
                    <div class="muted">Порядок: ${Number(item.order || 0)} · ${formatDate(item.createdAt)}</div>
                  </div>
                </div>
                <div class="badge-row">
                  <span class="badge ${item.enabled ? '' : 'draft'}">${item.enabled ? 'на сайте' : 'скрыто'}</span>
                </div>
              </div>
              ${item.alt ? `<p class="muted">${escapeHtml(item.alt)}</p>` : ''}
              <div class="item-actions">
                <button class="button ghost" data-edit-gallery="${item.id}">Редактировать</button>
                <button class="button secondary" data-toggle-gallery="${item.id}">${item.enabled ? 'Скрыть' : 'Показать'}</button>
                <button class="button ghost" data-delete-gallery="${item.id}">Удалить</button>
              </div>
            </article>
          `
        )
        .join('')
    : '<p class="muted">Фотографий пока нет. Загрузите первое фото слева.</p>';
}

function resetGalleryForm() {
  document.querySelector('#galleryForm').reset();
  document.querySelector('#galleryId').value = '';
  document.querySelector('#galleryImageUrl').value = '';
  document.querySelector('#galleryOrder').value = '0';
  document.querySelector('#galleryEnabled').checked = true;
  document.querySelector('#galleryCurrentImage').textContent = 'Для нового фото выберите один или несколько файлов.';
  selectors.galleryStatus.textContent = '';
  selectors.galleryStatus.className = 'inline-status';
}

function renderKnowledge() {
  selectors.knowledgeList.innerHTML = state.knowledge.length
    ? state.knowledge
        .map(
          (item) => `
            <article class="knowledge-item">
              <div class="item-row">
                <strong>${escapeHtml(item.title)}</strong>
                <span class="badge">${escapeHtml(item.kind)}</span>
              </div>
              <p class="muted">${escapeHtml(item.content)}</p>
            </article>
          `
        )
        .join('')
    : '<p class="muted">База знаний пуста.</p>';
}

function renderIntegrations() {
  const integrations = state.integrations;
  if (!integrations) return;

  document.querySelector('#telegramEnabled').checked = Boolean(integrations.telegram?.enabled);
  document.querySelector('#telegramAutoPublish').checked = Boolean(integrations.telegram?.autoPublish);
  document.querySelector('#telegramToken').value = integrations.telegram?.botToken || '';
  document.querySelector('#telegramChatId').value = integrations.telegram?.chatId || '';
  document.querySelector('#telegramSecret').value = integrations.telegram?.webhookSecret || '';

  document.querySelector('#bitrixEnabled').checked = Boolean(integrations.bitrix?.enabled);
  document.querySelector('#bitrixWebhook').value = integrations.bitrix?.webhookUrl || '';
  document.querySelector('#bitrixAssigned').value = integrations.bitrix?.defaultAssignedById || '';

  document.querySelector('#aiEnabled').checked = Boolean(integrations.ai?.enabled);
  document.querySelector('#aiBaseUrl').value = integrations.ai?.baseUrl || '';
  document.querySelector('#aiModel').value = integrations.ai?.model || '';
  document.querySelector('#aiApiKey').value = integrations.ai?.apiKey || '';
  document.querySelector('#aiPrompt').value = integrations.ai?.systemPrompt || '';
}

async function refreshAll() {
  const [health, dashboard, posts, integrations, sliderSettings, knowledge, gallery] = await Promise.all([
    api('/api/health'),
    api('/api/dashboard'),
    api('/api/posts'),
    api('/api/integrations'),
    api('/api/slider/settings'),
    api('/api/knowledge'),
    api('/api/gallery')
  ]);
  selectors.apiStatus.textContent = health.ok ? 'online' : 'offline';
  selectors.apiStatus.className = `status-pill ${health.ok ? 'ok' : 'error'}`;
  state.dashboard = dashboard;
  state.posts = posts;
  state.integrations = integrations;
  state.sliderSettings = sliderSettings;
  state.knowledge = knowledge;
  state.gallery = gallery;
  renderDashboard();
  renderPosts();
  renderSliderSettings();
  renderSliderAdmin();
  renderGalleryAdmin();
  renderIntegrations();
  renderKnowledge();
}

function setView(viewName) {
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === viewName));
  document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
  document.querySelector(`#${viewName}View`).classList.add('active');
  selectors.viewTitle.textContent = document.querySelector(`[data-view="${viewName}"]`).textContent;
}

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

document.querySelector('#refreshButton').addEventListener('click', () => {
  refreshAll().then(() => toast('Данные обновлены')).catch((error) => toast(error.message));
});

document.querySelector('#logoutButton').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/admin';
});

document.querySelector('#postForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.querySelector('#postId').value;
  const payload = {
    title: document.querySelector('#postTitle').value,
    slug: document.querySelector('#postSlug').value,
    tags: tagsFromInput(document.querySelector('#postTags').value),
    seoTitle: document.querySelector('#postSeoTitle').value,
    seoDescription: document.querySelector('#postSeoDescription').value,
    noIndex: document.querySelector('#postNoIndex').checked,
    content: document.querySelector('#postContent').value,
    videoUrl: document.querySelector('#postVideoUrl').value || null,
    showInSlider: document.querySelector('#postShowInSlider').checked,
    sliderOrder: Number(document.querySelector('#postSliderOrder').value || 0),
    publishedAt: document.querySelector('#postPublishedAt').value ? new Date(document.querySelector('#postPublishedAt').value).toISOString() : null
  };
  await api(id ? `/api/posts/${id}` : '/api/posts', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });
  event.target.reset();
  document.querySelector('#postId').value = '';
  document.querySelector('#postPublishedAt').value = '';
  document.querySelector('#postVideoUrl').value = '';
  document.querySelector('#postSeoTitle').value = '';
  document.querySelector('#postSeoDescription').value = '';
  document.querySelector('#postNoIndex').checked = false;
  await refreshAll();
  toast('Пост сохранен');
});

selectors.postList.addEventListener('click', async (event) => {
  const editId = event.target.dataset.editPost;
  const publishId = event.target.dataset.publishPost;
  const sliderId = event.target.dataset.sliderPost;
  const deleteId = event.target.dataset.deletePost;

  if (editId) {
    const post = state.posts.find((item) => item.id === editId);
    document.querySelector('#postId').value = post.id;
    document.querySelector('#postTitle').value = post.title;
    document.querySelector('#postSlug').value = post.slug;
    document.querySelector('#postTags').value = (post.tags || []).join(', ');
    document.querySelector('#postSeoTitle').value = post.seoTitle || '';
    document.querySelector('#postSeoDescription').value = post.seoDescription || '';
    document.querySelector('#postNoIndex').checked = Boolean(post.noIndex);
    document.querySelector('#postContent').value = post.content;
    document.querySelector('#postVideoUrl').value = post.videoUrl || '';
    document.querySelector('#postShowInSlider').checked = Boolean(post.showInSlider);
    document.querySelector('#postSliderOrder').value = post.sliderOrder || 0;
    
    const pubDate = post.publishedAt || post.createdAt;
    if (pubDate) {
      const d = new Date(pubDate);
      document.querySelector('#postPublishedAt').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } else {
      document.querySelector('#postPublishedAt').value = '';
    }
  }

  if (publishId) {
    await api(`/api/posts/${publishId}/publish`, { method: 'POST' });
    await refreshAll();
    toast('Пост опубликован');
  }

  if (sliderId) {
    const post = state.posts.find((item) => item.id === sliderId);
    await api(`/api/posts/${sliderId}/slider`, {
      method: 'POST',
      body: JSON.stringify({ showInSlider: !post.showInSlider })
    });
    await refreshAll();
    toast(post.showInSlider ? 'Пост убран из слайдера' : 'Пост добавлен в слайдер');
  }

  if (deleteId) {
    await api(`/api/posts/${deleteId}`, { method: 'DELETE' });
    await refreshAll();
    toast('Пост удален');
  }
});

document.querySelector('#telegramImportButton').addEventListener('click', async () => {
  const result = await api('/api/integrations/telegram/import', { method: 'POST' });
  await refreshAll();
  toast(`Импортировано: ${result.imported.length}`);
});

document.querySelector('#sliderSettingsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  state.sliderSettings = await api('/api/slider/settings', {
    method: 'POST',
    body: JSON.stringify({
      enabled: document.querySelector('#sliderEnabled').checked,
      autoplay: document.querySelector('#sliderAutoplay').checked,
      showControls: document.querySelector('#sliderShowControls').checked,
      showDots: document.querySelector('#sliderShowDots').checked,
      pauseOnHover: document.querySelector('#sliderPauseOnHover').checked,
      intervalMs: Number(document.querySelector('#sliderIntervalMs').value || 6500),
      transitionMs: Number(document.querySelector('#sliderTransitionMs').value || 450),
      maxItems: Number(document.querySelector('#sliderMaxItems').value || 6),
      imageFit: document.querySelector('#sliderImageFit').value || 'cover',
      imagePositionX: Number(document.querySelector('#sliderImagePositionX').value || 50),
      imagePositionY: Number(document.querySelector('#sliderImagePositionY').value || 50)
    })
  });
  renderSliderSettings();
  selectors.sliderStatus.textContent = 'Сохранено';
  toast('Настройки слайдера сохранены');
});

document.querySelector('#sliderRefreshButton').addEventListener('click', async () => {
  await refreshAll();
  toast('Слайдер обновлен');
});

selectors.sliderPostList.addEventListener('click', async (event) => {
  const postId = event.target.dataset.saveSliderPost;
  if (!postId) return;

  const toggle = selectors.sliderPostList.querySelector(`[data-slider-toggle="${postId}"]`);
  const order = selectors.sliderPostList.querySelector(`[data-slider-order="${postId}"]`);
  const imageFit = selectors.sliderPostList.querySelector(`[data-slider-image-fit="${postId}"]`);
  const imageX = selectors.sliderPostList.querySelector(`[data-slider-image-x="${postId}"]`);
  const imageY = selectors.sliderPostList.querySelector(`[data-slider-image-y="${postId}"]`);
  await api(`/api/posts/${postId}/slider`, {
    method: 'POST',
    body: JSON.stringify({
      showInSlider: toggle.checked,
      sliderOrder: Number(order.value || 0),
      sliderImageFit: imageFit.value,
      sliderImagePositionX: Number(imageX.value || 50),
      sliderImagePositionY: Number(imageY.value || 50)
    })
  });
  await refreshAll();
  toast('Пост слайдера сохранен');
});

document.querySelector('#galleryForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  selectors.galleryStatus.textContent = 'Сохраняю...';
  selectors.galleryStatus.className = 'inline-status';
  try {
    const id = document.querySelector('#galleryId').value;
    const files = [...document.querySelector('#galleryFile').files];
    let url = document.querySelector('#galleryImageUrl').value;
    const caption = document.querySelector('#galleryCaption').value;
    const alt = document.querySelector('#galleryAlt').value;
    const order = Number(document.querySelector('#galleryOrder').value || 0);
    const enabled = document.querySelector('#galleryEnabled').checked;

    if (!id && files.length > 1) {
      for (const [index, file] of files.entries()) {
        const uploadedUrl = await uploadImageFile(file);
        await api('/api/gallery', {
          method: 'POST',
          body: JSON.stringify({
            url: uploadedUrl,
            caption: caption || file.name.replace(/\.[^.]+$/, ''),
            alt: alt || caption || file.name.replace(/\.[^.]+$/, ''),
            order: order + index,
            enabled
          })
        });
      }
      resetGalleryForm();
      await refreshAll();
      toast(`Загружено фото: ${files.length}`);
      return;
    }

    if (files[0]) url = await uploadImageFile(files[0]);
    if (!url) throw new Error('Выберите фото для загрузки.');

    await api(id ? `/api/gallery/${id}` : '/api/gallery', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({
        url,
        caption,
        alt,
        order,
        enabled
      })
    });
    resetGalleryForm();
    await refreshAll();
    toast('Фото сохранено');
  } catch (error) {
    selectors.galleryStatus.textContent = error.message;
    selectors.galleryStatus.className = 'inline-status error';
    toast(error.message);
  }
});

document.querySelector('#galleryResetButton').addEventListener('click', resetGalleryForm);

document.querySelector('#galleryRefreshButton').addEventListener('click', async () => {
  await refreshAll();
  toast('Фотогалерея обновлена');
});

selectors.galleryList.addEventListener('click', async (event) => {
  const editId = event.target.dataset.editGallery;
  const toggleId = event.target.dataset.toggleGallery;
  const deleteId = event.target.dataset.deleteGallery;

  if (editId) {
    const item = state.gallery.find((entry) => entry.id === editId);
    if (!item) return;
    document.querySelector('#galleryId').value = item.id;
    document.querySelector('#galleryImageUrl').value = item.url || '';
    document.querySelector('#galleryCaption').value = item.caption || '';
    document.querySelector('#galleryAlt').value = item.alt || '';
    document.querySelector('#galleryOrder').value = item.order || 0;
    document.querySelector('#galleryEnabled').checked = Boolean(item.enabled);
    document.querySelector('#galleryFile').value = '';
    document.querySelector('#galleryCurrentImage').innerHTML = `Текущее фото: <a href="${escapeHtml(safeUrl(item.url))}" target="_blank" rel="noopener">открыть</a>. Можно выбрать новый файл для замены.`;
    selectors.galleryStatus.textContent = 'Редактирование фото';
    selectors.galleryStatus.className = 'inline-status';
  }

  if (toggleId) {
    const item = state.gallery.find((entry) => entry.id === toggleId);
    if (!item) return;
    await api(`/api/gallery/${toggleId}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: !item.enabled })
    });
    await refreshAll();
    toast(item.enabled ? 'Фото скрыто' : 'Фото показано');
  }

  if (deleteId) {
    await api(`/api/gallery/${deleteId}`, { method: 'DELETE' });
    resetGalleryForm();
    await refreshAll();
    toast('Фото удалено');
  }
});

document.querySelector('#integrationsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    telegram: {
      enabled: document.querySelector('#telegramEnabled').checked,
      mode: 'polling',
      autoPublish: document.querySelector('#telegramAutoPublish').checked,
      chatId: document.querySelector('#telegramChatId').value
    },
    bitrix: {
      enabled: document.querySelector('#bitrixEnabled').checked,
      defaultAssignedById: document.querySelector('#bitrixAssigned').value
    },
    ai: {
      enabled: document.querySelector('#aiEnabled').checked,
      baseUrl: document.querySelector('#aiBaseUrl').value,
      model: document.querySelector('#aiModel').value,
      systemPrompt: document.querySelector('#aiPrompt').value
    }
  };
  state.integrations = await api('/api/integrations', { method: 'POST', body: JSON.stringify(payload) });
  renderIntegrations();
  selectors.integrationStatus.textContent = 'Сохранено';
  selectors.integrationStatus.className = 'inline-status';
  toast('Интеграции сохранены');
});

document.querySelector('#integrationsForm').addEventListener('click', async (event) => {
  const name = event.target.dataset.test;
  if (!name) return;
  try {
    const result = await api(`/api/integrations/${name}/test`, { method: 'POST' });
    selectors.integrationStatus.textContent = result.message || 'OK';
    selectors.integrationStatus.className = 'inline-status';
  } catch (error) {
    selectors.integrationStatus.textContent = error.message;
    selectors.integrationStatus.className = 'inline-status error';
  }
});

document.querySelector('#assistantForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = await api('/api/ai/assistant', {
    method: 'POST',
    body: JSON.stringify({
      message: document.querySelector('#assistantMessage').value,
      visitorId: document.querySelector('#visitorId').value
    })
  });
  document.querySelector('#assistantAnswer').textContent = result.answer;
});

document.querySelector('#knowledgeForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  await api('/api/knowledge', {
    method: 'POST',
    body: JSON.stringify({
      title: document.querySelector('#knowledgeTitle').value,
      kind: document.querySelector('#knowledgeKind').value,
      tags: tagsFromInput(document.querySelector('#knowledgeTags').value),
      content: document.querySelector('#knowledgeContent').value
    })
  });
  event.target.reset();
  document.querySelector('#knowledgeKind').value = 'note';
  await refreshAll();
  toast('Запись добавлена');
});

document.querySelector('#passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  selectors.passwordStatus.textContent = '';
  selectors.passwordStatus.className = 'inline-status';
  try {
    await api('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: document.querySelector('#currentPassword').value,
        password: document.querySelector('#newPassword').value,
        passwordConfirmation: document.querySelector('#passwordConfirmation').value
      })
    });
    event.target.reset();
    selectors.passwordStatus.textContent = 'Пароль изменен. Выполняется выход...';
    toast('Пароль изменен');
    setTimeout(() => {
      window.location.href = '/admin';
    }, 900);
  } catch (error) {
    selectors.passwordStatus.textContent = error.message;
    selectors.passwordStatus.className = 'inline-status error';
  }
});

refreshAll().catch((error) => {
  selectors.apiStatus.textContent = 'offline';
  selectors.apiStatus.className = 'status-pill error';
  toast(error.message);
});
