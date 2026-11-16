import assert from 'node:assert';

import { test } from 'node:test';

import { buildMcpTools, createMcpServer, MCP_SERVER_NAME, MCP_SERVER_VERSION, MCP_ENDPOINT_PATH } from '../src/mcp.js';

function makeDeps() {
  const video = (over = {}) => ({
    yid: 'abc123def45',
    fileName: 'abc123def45.mp4',
    uploader: 'Chaine Test',
    tags: ['tag1', 'tag2'],
    view_count: 100,
    like_count: 10,
    comment_count: 5,
    mtime: 1700000000,
    isGz: false,
    keepUnzipped: false,
    channel_url: 'https://youtube.com/@chaine',
    playlist_title: null,
    score: 1,
    ...over,
  });

  const db = {
    database: [video(), video({ yid: 'xyz987uvw65', fileName: 'xyz987uvw65.mp4', uploader: 'Autre', tags: ['tag2'], mtime: 1700000100 })],
    queue: ['abc123def45'],
    favorites: ['xyz987uvw65'],
    history: [video()],
    playlists: [{ name: 'Ma playlist', videoIds: ['abc123def45'] }],
    followedChannels: [{ name: 'Chaine Test', url: 'https://youtube.com/@chaine', lastChecked: 123 }],
    search: (q) => db.database.filter(v => v.fileName.includes(q) || v.uploader.includes(q) || v.tags.some(t => t.includes(q))),
    getFile: (id) => db.database.find(v => v.yid === id) || null,
    getQueue: () => db.queue.map(id => db.getFile(id)).filter(Boolean),
    addToQueue: (id) => { if (!db.queue.includes(id) && db.getFile(id)) { db.queue.push(id); return true; } return false; },
    removeFromQueue: (id) => { const i = db.queue.indexOf(id); if (i >= 0) db.queue.splice(i, 1); },
    clearQueue: () => { db.queue = []; },
    getFavorites: () => db.favorites.map(id => db.getFile(id)).filter(Boolean),
    toggleFavorite: (id) => { const i = db.favorites.indexOf(id); if (i >= 0) { db.favorites.splice(i, 1); return false; } db.favorites.push(id); return true; },
    getHistory: () => db.history,
    clearHistory: () => { db.history = []; },
    getPlaylists: () => db.playlists.map(p => ({ name: p.name, videoIds: p.videoIds })),
    getPlaylist: (name) => { const p = db.playlists.find(p => p.name === name); return p ? { name: p.name, videos: p.videoIds.map(id => db.getFile(id)).filter(Boolean) } : null; },
    getFollowedChannels: () => db.followedChannels,
    getAllChannels: () => [...new Set(db.database.map(v => v.uploader))],
    getAllTags: () => [...new Set(db.database.flatMap(v => v.tags))],
  };

  const calls = { download: [], checkChannels: 0, clearCache: 0, deleted: [] };

  return {
    deps: {
      db,
      download: (url) => calls.download.push(url),
      checkChannelsForNewVideos: async () => { calls.checkChannels++; },
      clearCache: async () => { calls.clearCache++; return { message: 'ok', clearedVideos: 2 }; },
      deleteVideo: (id) => { const v = db.getFile(id); if (!v) return null; calls.deleted.push(id); return v; },
      getBase: () => '/tmp/videos',
      getConfig: () => ({ storagePath: '/tmp/videos' }),
      appVersion: '1.17.10',
      getLaunchDarklyStatus: () => ({ enabled: false, reason: 'test', ready: false }),
      getAllFeatureFlags: () => ({ 'ab-tubearchivist-ui': true }),
      FROZEN_FLAGS_100: Object.freeze({ 'ab-tubearchivist-ui': true }),
    },
    calls,
    db,
  };
}

function parse(result) {
  assert.ok(result.content, 'result has content');
  assert.strictEqual(result.content[0].type, 'text');
  return JSON.parse(result.content[0].text);
}

function findTool(tools, name) {
  const t = tools.find(t => t.name === name);
  assert.ok(t, `tool ${name} existe`);
  return t;
}

test('buildMcpTools expose tous les tools attendus', () => {
  const { deps } = makeDeps();
  const tools = buildMcpTools(deps);
  const names = tools.map(t => t.name);
  for (const expected of ['list_videos', 'search_videos', 'get_video', 'download_url', 'queue_list', 'queue_add', 'queue_remove', 'queue_clear', 'favorites_list', 'favorite_toggle', 'history_list', 'history_clear', 'playlists_list', 'playlist_get', 'followed_channels_list', 'check_channels', 'clear_cache', 'delete_video', 'stats', 'flags_status']) {
    assert.ok(names.includes(expected), `tool manquant: ${expected}`);
  }
  for (const t of tools) {
    assert.ok(t.description, `${t.name} a une description`);
    assert.strictEqual(typeof t.handler, 'function');
  }
});

test('list_videos filtre par chaîne et tag, triées par mtime décroissant', async () => {
  const { deps } = makeDeps();
  const tools = buildMcpTools(deps);
  const list = findTool(tools, 'list_videos');

  const all = parse(await list.handler({}));
  assert.strictEqual(all.total, 2);
  assert.strictEqual(all.videos[0].id, 'xyz987uvw65'); // mtime plus récent d'abord

  const byChannel = parse(await list.handler({ channel: 'Chaine Test' }));
  assert.strictEqual(byChannel.total, 1);
  assert.strictEqual(byChannel.videos[0].uploader, 'Chaine Test');

  const byTag = parse(await list.handler({ tag: 'tag2' }));
  assert.strictEqual(byTag.total, 2);

  const paged = parse(await list.handler({ limit: 1, offset: 1 }));
  assert.strictEqual(paged.count, 1);
  assert.strictEqual(paged.videos[0].id, 'abc123def45');
});

test('search_videos et get_video', async () => {
  const { deps } = makeDeps();
  const tools = buildMcpTools(deps);

  const search = findTool(tools, 'search_videos');
  const found = parse(await search.handler({ query: 'Autre' }));
  assert.strictEqual(found.count, 1);
  assert.strictEqual(found.videos[0].id, 'xyz987uvw65');

  const get = findTool(tools, 'get_video');
  const one = parse(await get.handler({ id: 'abc123def45' }));
  assert.strictEqual(one.fileName, 'abc123def45.mp4');

  const missing = await get.handler({ id: 'nope' });
  assert.strictEqual(missing.isError, true);
});

test('download_url déclenche le téléchargement', async () => {
  const { deps, calls } = makeDeps();
  const tools = buildMcpTools(deps);
  const dl = findTool(tools, 'download_url');
  const res = parse(await dl.handler({ url: 'https://youtube.com/watch?v=abc123def45' }));
  assert.strictEqual(res.success, true);
  assert.deepStrictEqual(calls.download, ['https://youtube.com/watch?v=abc123def45']);
});

test("gestion de la file d'attente", async () => {
  const { deps, db } = makeDeps();
  const tools = buildMcpTools(deps);

  const list = findTool(tools, 'queue_list');
  assert.strictEqual(parse(await list.handler({})).count, 1);

  const add = findTool(tools, 'queue_add');
  const added = parse(await add.handler({ id: 'xyz987uvw65' }));
  assert.strictEqual(added.success, true);
  assert.strictEqual(added.queueCount, 2);
  const dup = await add.handler({ id: 'xyz987uvw65' });
  assert.strictEqual(dup.isError, true);

  const remove = findTool(tools, 'queue_remove');
  parse(await remove.handler({ id: 'xyz987uvw65' }));
  assert.strictEqual(db.queue.length, 1);

  const clear = findTool(tools, 'queue_clear');
  parse(await clear.handler({}));
  assert.strictEqual(db.queue.length, 0);
});

test('favoris, historique, playlists', async () => {
  const { deps, db } = makeDeps();
  const tools = buildMcpTools(deps);

  const favList = findTool(tools, 'favorites_list');
  assert.strictEqual(parse(await favList.handler({})).count, 1);

  const toggle = findTool(tools, 'favorite_toggle');
  const on = parse(await toggle.handler({ id: 'abc123def45' }));
  assert.strictEqual(on.isFavorite, true);
  const off = parse(await toggle.handler({ id: 'xyz987uvw65' }));
  assert.strictEqual(off.isFavorite, false);

  const hist = findTool(tools, 'history_list');
  assert.strictEqual(parse(await hist.handler({})).count, 1);
  const histClear = findTool(tools, 'history_clear');
  parse(await histClear.handler({}));
  assert.strictEqual(db.history.length, 0);

  const pl = findTool(tools, 'playlists_list');
  const playlists = parse(await pl.handler({}));
  assert.strictEqual(playlists.playlists[0].videoCount, 1);

  const plGet = findTool(tools, 'playlist_get');
  const p = parse(await plGet.handler({ name: 'Ma playlist' }));
  assert.strictEqual(p.count, 1);
  const missing = await plGet.handler({ name: 'inexistante' });
  assert.strictEqual(missing.isError, true);
});

test('check_channels, clear_cache, delete_video appellent les bonnes deps', async () => {
  const { deps, calls } = makeDeps();
  const tools = buildMcpTools(deps);

  parse(await findTool(tools, 'check_channels').handler({}));
  assert.strictEqual(calls.checkChannels, 1);

  const cc = parse(await findTool(tools, 'clear_cache').handler({}));
  assert.strictEqual(cc.success, true);
  assert.strictEqual(cc.clearedVideos, 2);
  assert.strictEqual(calls.clearCache, 1);

  const del = findTool(tools, 'delete_video');
  const ok = parse(await del.handler({ id: 'abc123def45' }));
  assert.strictEqual(ok.success, true);
  assert.strictEqual(ok.fileName, 'abc123def45.mp4');
  assert.deepStrictEqual(calls.deleted, ['abc123def45']);
  const ko = await del.handler({ id: 'inconnu' });
  assert.strictEqual(ko.isError, true);
});

test('stats et flags_status', async () => {
  const { deps } = makeDeps();
  const tools = buildMcpTools(deps);

  const stats = parse(await findTool(tools, 'stats').handler({}));
  assert.strictEqual(stats.appVersion, '1.17.10');
  assert.strictEqual(stats.storagePath, '/tmp/videos');
  assert.strictEqual(stats.videos, 2);
  assert.strictEqual(stats.queue, 1);
  assert.strictEqual(stats.favorites, 1);
  assert.strictEqual(stats.channels, 2);
  assert.strictEqual(stats.tags, 2);

  const flags = parse(await findTool(tools, 'flags_status').handler({}));
  assert.strictEqual(flags.launchdarkly.enabled, false);
  assert.strictEqual(flags.frozenAt100['ab-tubearchivist-ui'], true);
});

test('followed_channels_list inclut le nombre de vidéos', async () => {
  const { deps } = makeDeps();
  const tools = buildMcpTools(deps);
  const res = parse(await findTool(tools, 'followed_channels_list').handler({}));
  assert.strictEqual(res.count, 1);
  assert.strictEqual(res.channels[0].videoCount, 1);
});

test('createMcpServer construit un serveur avec les tools enregistrés', () => {
  const { deps } = makeDeps();
  const server = createMcpServer(deps);
  assert.ok(server, 'serveur créé');
  assert.strictEqual(MCP_SERVER_NAME, 'youtube-local');
  assert.strictEqual(MCP_SERVER_VERSION, '1.0.0');
  assert.strictEqual(MCP_ENDPOINT_PATH, '/mcp');
});
