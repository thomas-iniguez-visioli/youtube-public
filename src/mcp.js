import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import log from './logger.js';

export const MCP_SERVER_NAME = 'youtube-local';
export const MCP_SERVER_VERSION = '1.0.0';
export const MCP_ENDPOINT_PATH = '/mcp';

function textResult(data, isError = false) {
  return {
    ...(isError ? { isError: true } : {}),
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  };
}

function summarizeVideo(v) {
  if (!v) return null;
  return {
    id: v.yid,
    fileName: v.fileName,
    uploader: v.uploader,
    tags: v.tags || [],
    view_count: v.view_count,
    like_count: v.like_count,
    comment_count: v.comment_count,
    mtime: v.mtime,
    isGz: !!v.isGz,
    keepUnzipped: !!v.keepUnzipped,
    channel_url: v.channel_url || null,
    playlist_title: v.playlist_title || null,
  };
}

function directorySizeBytes(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) total += directorySizeBytes(full);
      else total += entry.isFile() ? fs.statSync(full).size : 0;
    } catch {
      // fichier supprimé entre-temps : ignoré
    }
  }
  return total;
}

/**
 * Définit les tools exposés par le serveur MCP. La même liste sert au transport
 * MCP (POST /mcp) et à l'API de l'interface (/api/mcp/tools, /api/mcp/call).
 *
 * deps: { db, download, checkChannelsForNewVideos, clearCache, deleteVideo,
 *         getBase, getConfig, appVersion, getLaunchDarklyStatus,
 *         getAllFeatureFlags, FROZEN_FLAGS_100 }
 */
export function buildMcpTools(deps) {
  const { db } = deps;

  return [
    {
      name: 'list_videos',
      description: 'Liste les vidéos de la bibliothèque locale, triées par date (plus récentes d\'abord), avec filtres optionnels par chaîne et/ou tag.',
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional().describe('Nombre max de vidéos renvoyées (défaut 50, max 500)'),
        offset: z.number().int().min(0).optional().describe('Décalage pour la pagination (défaut 0)'),
        channel: z.string().optional().describe('Filtrer par nom de chaîne (uploader)'),
        tag: z.string().optional().describe('Filtrer par tag'),
      },
      handler: async ({ limit = 50, offset = 0, channel, tag } = {}) => {
        let results = [...db.database];
        if (channel) results = results.filter(v => v.uploader === channel);
        if (tag) results = results.filter(v => Array.isArray(v.tags) && v.tags.includes(tag));
        results.sort((a, b) => ((b.mtime || 0) - (a.mtime || 0)) || ((b.score || 0) - (a.score || 0)));
        const slice = results.slice(offset, offset + limit).map(summarizeVideo);
        return textResult({ total: results.length, count: slice.length, videos: slice });
      },
    },
    {
      name: 'search_videos',
      description: 'Recherche texte dans la bibliothèque locale (nom de fichier, tags, uploader).',
      inputSchema: {
        query: z.string().min(1).describe('Texte à rechercher'),
        limit: z.number().int().min(1).max(200).optional().describe('Nombre max de résultats (défaut 20)'),
      },
      handler: async ({ query, limit = 20 } = {}) => {
        const results = db.search(query).slice(0, limit).map(summarizeVideo);
        return textResult({ query, count: results.length, videos: results });
      },
    },
    {
      name: 'get_video',
      description: 'Retourne les métadonnées complètes d\'une vidéo à partir de son ID YouTube (11 caractères).',
      inputSchema: {
        id: z.string().min(1).describe('ID YouTube de la vidéo'),
      },
      handler: async ({ id } = {}) => {
        const file = db.getFile(id);
        if (!file) return textResult({ error: `Vidéo introuvable: ${id}` }, true);
        return textResult(summarizeVideo(file));
      },
    },
    {
      name: 'download_url',
      description: 'Lance le téléchargement d\'une URL YouTube (vidéo, chaîne ou playlist) via yt-dlp.',
      inputSchema: {
        url: z.string().min(1).describe('URL YouTube à télécharger'),
      },
      handler: async ({ url } = {}) => {
        deps.download(url);
        return textResult({ success: true, url, message: 'Téléchargement lancé.' });
      },
    },
    {
      name: 'queue_list',
      description: 'Liste la file d\'attente de téléchargement.',
      inputSchema: {},
      handler: async () => {
        const videos = db.getQueue().map(summarizeVideo);
        return textResult({ count: videos.length, queue: videos });
      },
    },
    {
      name: 'queue_add',
      description: 'Ajoute une vidéo de la bibliothèque à la file d\'attente.',
      inputSchema: {
        id: z.string().min(1).describe('ID YouTube de la vidéo à ajouter'),
      },
      handler: async ({ id } = {}) => {
        const added = db.addToQueue(id);
        if (!added) return textResult({ error: `Impossible d'ajouter ${id} (inconnu ou déjà en file)` }, true);
        return textResult({ success: true, id, queueCount: db.queue.length });
      },
    },
    {
      name: 'queue_remove',
      description: 'Retire une vidéo de la file d\'attente.',
      inputSchema: {
        id: z.string().min(1).describe('ID YouTube de la vidéo à retirer'),
      },
      handler: async ({ id } = {}) => {
        db.removeFromQueue(id);
        return textResult({ success: true, id, queueCount: db.queue.length });
      },
    },
    {
      name: 'queue_clear',
      description: 'Vide entièrement la file d\'attente.',
      inputSchema: {},
      handler: async () => {
        db.clearQueue();
        return textResult({ success: true, queueCount: 0 });
      },
    },
    {
      name: 'favorites_list',
      description: 'Liste les vidéos favorites.',
      inputSchema: {},
      handler: async () => {
        const videos = db.getFavorites().map(summarizeVideo);
        return textResult({ count: videos.length, favorites: videos });
      },
    },
    {
      name: 'favorite_toggle',
      description: 'Ajoute ou retire une vidéo des favoris.',
      inputSchema: {
        id: z.string().min(1).describe('ID YouTube de la vidéo'),
      },
      handler: async ({ id } = {}) => {
        const isFavorite = db.toggleFavorite(id);
        return textResult({ success: true, id, isFavorite, favoritesCount: db.favorites.length });
      },
    },
    {
      name: 'history_list',
      description: 'Liste l\'historique de lecture (plus récent d\'abord).',
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional().describe('Nombre max d\'entrées (défaut 50)'),
      },
      handler: async ({ limit = 50 } = {}) => {
        const videos = db.getHistory().slice(-limit).reverse().map(summarizeVideo);
        return textResult({ count: videos.length, history: videos });
      },
    },
    {
      name: 'history_clear',
      description: 'Vide entièrement l\'historique de lecture.',
      inputSchema: {},
      handler: async () => {
        db.clearHistory();
        return textResult({ success: true });
      },
    },
    {
      name: 'playlists_list',
      description: 'Liste les playlists avec le nombre de vidéos de chacune.',
      inputSchema: {},
      handler: async () => {
        const playlists = db.getPlaylists().map(p => ({ name: p.name, videoCount: (p.videoIds || []).length }));
        return textResult({ count: playlists.length, playlists });
      },
    },
    {
      name: 'playlist_get',
      description: 'Retourne une playlist et ses vidéos.',
      inputSchema: {
        name: z.string().min(1).describe('Nom exact de la playlist'),
      },
      handler: async ({ name } = {}) => {
        const playlist = db.getPlaylist(name);
        if (!playlist) return textResult({ error: `Playlist introuvable: ${name}` }, true);
        return textResult({ name: playlist.name, count: playlist.videos.length, videos: playlist.videos.map(summarizeVideo) });
      },
    },
    {
      name: 'followed_channels_list',
      description: 'Liste les chaînes suivies (avec leur URL et la date de dernière vérification).',
      inputSchema: {},
      handler: async () => {
        const channels = db.getFollowedChannels().map(ch => ({
          ...ch,
          videoCount: db.database.filter(v => v.uploader === ch.name).length,
        }));
        return textResult({ count: channels.length, channels });
      },
    },
    {
      name: 'check_channels',
      description: 'Vérifie maintenant les nouvelles vidéos des chaînes suivies et les télécharge.',
      inputSchema: {},
      handler: async () => {
        await deps.checkChannelsForNewVideos();
        return textResult({ success: true, message: 'Vérification des chaînes terminée.' });
      },
    },
    {
      name: 'clear_cache',
      description: 'Vide les caches temporaires (suggestions, vidéos décompressées inactives, cache Chromium).',
      inputSchema: {},
      handler: async () => {
        const result = await deps.clearCache();
        return textResult({ success: true, ...result });
      },
    },
    {
      name: 'delete_video',
      description: 'Supprime définitivement une vidéo (fichier + archive .zip + entrée en base).',
      inputSchema: {
        id: z.string().min(1).describe('ID YouTube de la vidéo à supprimer'),
      },
      handler: async ({ id } = {}) => {
        const deleted = deps.deleteVideo(id);
        if (!deleted) return textResult({ error: `Vidéo introuvable: ${id}` }, true);
        return textResult({ success: true, id, fileName: deleted.fileName });
      },
    },
    {
      name: 'stats',
      description: 'Statistiques de l\'application : nombre de vidéos, file, favoris, taille du dossier de stockage, version.',
      inputSchema: {},
      handler: async () => {
        const base = deps.getBase();
        return textResult({
          appVersion: deps.appVersion,
          storagePath: base,
          storageBytes: directorySizeBytes(base),
          videos: db.database.length,
          queue: db.queue.length,
          favorites: db.favorites.length,
          history: db.history.length,
          playlists: db.playlists.length,
          followedChannels: db.followedChannels.length,
          channels: db.getAllChannels().length,
          tags: db.getAllTags().length,
        });
      },
    },
    {
      name: 'flags_status',
      description: 'État des feature flags : LaunchDarkly est désactivé, les flags historiques sont gelés à 100%.',
      inputSchema: {},
      handler: async () => {
        return textResult({
          launchdarkly: deps.getLaunchDarklyStatus(),
          frozenAt100: deps.FROZEN_FLAGS_100,
          flags: deps.getAllFeatureFlags(),
        });
      },
    },
  ];
}

/** Construit une instance de serveur MCP prête à être connectée à un transport. */
export function createMcpServer(deps) {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } }
  );
  for (const tool of buildMcpTools(deps)) {
    server.registerTool(
      tool.name,
      { title: tool.name, description: tool.description, inputSchema: tool.inputSchema },
      tool.handler
    );
  }
  return server;
}

/**
 * Monte sur l'app Express :
 *  - POST /mcp            : endpoint MCP (Streamable HTTP, stateless)
 *  - GET  /api/mcp/tools  : liste des tools + schémas (pour l'interface)
 *  - POST /api/mcp/call   : appelle un tool depuis l'interface ({ name, arguments })
 */
export function registerMcpRoutes(web, deps) {
  const tools = buildMcpTools(deps);

  web.post(MCP_ENDPOINT_PATH, async (req, res) => {
    try {
      const server = createMcpServer(deps);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      log.error(`Erreur endpoint MCP ${MCP_ENDPOINT_PATH}: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message }, id: null });
      }
    }
  });

  web.get('/api/mcp/tools', (req, res) => {
    res.json({
      server: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      endpoint: MCP_ENDPOINT_PATH,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: z.toJSONSchema(z.object(t.inputSchema)),
      })),
    });
  });

  web.post('/api/mcp/call', async (req, res) => {
    try {
      const { name, arguments: args } = req.body || {};
      const tool = tools.find(t => t.name === name);
      if (!tool) {
        return res.status(404).json({ error: `Tool inconnu: ${name}` });
      }
      const result = await tool.handler(args || {});
      res.json(result);
    } catch (err) {
      log.error(`Erreur appel tool MCP ${req.body && req.body.name}: ${err.message}`);
      res.status(500).json({ isError: true, content: [{ type: 'text', text: String(err && err.message || err) }] });
    }
  });
}
