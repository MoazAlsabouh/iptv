import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BACKEND_BASE_URL } from '../../context/AuthContext';
import {
  DEFAULT_NETWORKS,
  ChannelNetwork,
  matchChannelToNetwork,
  getStoredCustomNetworks,
  saveCustomNetworks,
} from '../../config/networks';
import {
  getRemainingDays,
  formatRemainingDaysArabic,
  formatDateStandard,
} from '../../utils/dateFormat';
import { fetchBackendPlaylist } from '../../utils/m3uParser';
import { MediaItem } from '../../types/media';
import { toYouTubeEmbedUrl } from '../../components/player/TVPlayer';
import { ChannelLogo } from '../../components/ChannelLogo';

export interface VodOverrideItem {
  tmdbId: string;
  title: string;
  mediaType: 'movie' | 'tv';
  youtubeUrl: string | null;
  useYoutubePrimary: boolean;
  archiveUrl: string | null;
  useArchivePrimary: boolean;
  notes: string | null;
  reviewStatus?: 'pending' | 'verified' | 'hidden' | 'deleted';
  approvedSourceType?: 'default_servers' | 'archive' | 'youtube' | null;
  updatedAt?: string;
}

export interface VodSearchResult {
  id: string | number;
  title?: string;
  name?: string;
  media_type?: string;
  poster?: string;
  poster_path?: string;
  year?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
}

export interface ArchiveCheckResult {
  identifier: string;
  title: string;
  year?: string;
  downloads?: number;
  directUrl?: string | null;
  embedUrl?: string;
  recommendedUrl?: string;
}

export interface TvSeasonItem {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  overview?: string;
  poster?: string;
}

export interface TvEpisodeItem {
  episodeNumber: number;
  name: string;
  overview?: string;
  stillPath?: string;
  airDate?: string;
}

export interface ChannelOverrideItem {
  id: string;
  name?: string | null;
  logo?: string | null;
  category?: string | null;
  streamUrl?: string | null;
  streamType: 'auto' | 'hls' | 'youtube' | 'iframe';
  isHidden: boolean;
  isDeleted: boolean;
  sortOrder: number | null;
  isCustom: boolean;
  updatedAt?: string;
}

interface SubscriptionCode {
  id: number;
  code: string;
  resellerId?: number | null;
  resellerName?: string | null;
  durationDays: number;
  maxDevices: number;
  deviceCount: number;
  status: 'active' | 'unused' | 'expired' | 'suspended';
  note: string;
  createdAt: string;
  activatedAt?: string;
  expiresAt?: string;
  remainingDays: number;
  isExpired: boolean;
}

interface ResellerStats {
  total: number;
  active: number;
  unused: number;
  suspended: number;
  expired: number;
  activated: number;
}

interface Reseller {
  id: number;
  name: string;
  username: string;
  email?: string | null;
  status: 'active' | 'suspended';
  note: string;
  createdAt: string;
  stats: ResellerStats;
}

interface Stats {
  total: number;
  active: number;
  unused: number;
  expired: number;
  suspended: number;
}

export interface VodServerConfig {
  id: string;
  name: string;
  enabled: boolean;
}

export interface VodSettings {
  live_probe_enabled: boolean;
  youtube_policy: 'fallback_only' | 'disabled';
  servers_priority: VodServerConfig[];
}

const DEFAULT_VOD_SETTINGS: VodSettings = {
  live_probe_enabled: true,
  youtube_policy: 'fallback_only',
  servers_priority: [
    { id: 'vidlink', name: 'VidLink', enabled: true },
    { id: 'vidsrc_cc', name: 'VidSrc CC', enabled: true },
    { id: 'vidsrc_to', name: 'VidSrc', enabled: true },
    { id: 'embed_su', name: 'Embed.su', enabled: true },
    { id: 'autoembed', name: 'AutoEmbed', enabled: true },
    { id: '2embed', name: '2Embed', enabled: true },
    { id: 'vidsrc_me', name: 'VidSrc Me', enabled: true },
  ],
};

const ARABIC_SERIES_CATEGORIES = [
  { id: 'all', label: 'الكل' },
  { id: 'drama', label: 'دراما' },
  { id: 'comedy', label: 'كوميديا' },
  { id: 'historical', label: 'تاريخي وحربي' },
  { id: 'action', label: 'أكشن ومغامرات' },
  { id: 'crime', label: 'جريمة وتشويق' },
  { id: 'family', label: 'عائلي' },
];

const ARABIC_MOVIES_CATEGORIES = [
  { id: 'all', label: 'الكل' },
  { id: 'comedy', label: 'كوميديا' },
  { id: 'drama', label: 'دراما' },
  { id: 'action', label: 'أكشن ومغامرات' },
  { id: 'romance', label: 'رومانسي' },
  { id: 'history', label: 'تاريخي' },
  { id: 'horror', label: 'رعب وإثارة' },
];

const ADMIN_TOKEN_KEY = 'iptv_admin_token';
const ADMIN_STORAGE_KEY = 'iptv_admin_key';

export default function AdminScreen(): React.JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;

  // المصادقة
  const [adminToken, setAdminToken] = useState<string>('');
  const [adminKey, setAdminKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [identifierInput, setIdentifierInput] = useState<string>('admin');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // التنقل بين التبويبات الرئيسية
  const [activeTab, setActiveTab] = useState<'codes' | 'resellers' | 'vod' | 'arabic_vod' | 'networks' | 'channels'>('codes');

  // إعدادات وسيرفرات الأفلام والمسلسلات
  const [vodSettings, setVodSettings] = useState<VodSettings>(DEFAULT_VOD_SETTINGS);
  const [vodLoading, setVodLoading] = useState<boolean>(false);
  const [vodSaving, setVodSaving] = useState<boolean>(false);

  // إدارة تخصيص المحتوى العربي VOD وربط Archive و YouTube
  const [vodOverrides, setVodOverrides] = useState<VodOverrideItem[]>([]);
  const [vodOverridesLoading, setVodOverridesLoading] = useState<boolean>(false);
  const [searchVodQuery, setSearchVodQuery] = useState<string>('');
  const [searchVodLoading, setSearchVodLoading] = useState<boolean>(false);
  const [searchVodResults, setSearchVodResults] = useState<VodSearchResult[]>([]);
  const [selectedVodItem, setSelectedVodItem] = useState<VodSearchResult | null>(null);
  // مواسم وحلقات المسلسل العربي المختار
  const [tvSeasons, setTvSeasons] = useState<TvSeasonItem[]>([]);
  const [tvSeasonsLoading, setTvSeasonsLoading] = useState<boolean>(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null); // null = كامل المسلسل
  const [tvEpisodes, setTvEpisodes] = useState<TvEpisodeItem[]>([]);
  const [tvEpisodesLoading, setTvEpisodesLoading] = useState<boolean>(false);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null); // null = كامل الموسم
  const [archiveChecking, setArchiveChecking] = useState<boolean>(false);
  const [archiveResults, setArchiveResults] = useState<ArchiveCheckResult[]>([]);
  const [archiveCheckMessage, setArchiveCheckMessage] = useState<string | null>(null);
  const [vodYoutubeUrl, setVodYoutubeUrl] = useState<string>('');
  const [vodYoutubePrimary, setVodYoutubePrimary] = useState<boolean>(false);
  const [vodArchiveUrl, setVodArchiveUrl] = useState<string>('');
  const [vodArchivePrimary, setVodArchivePrimary] = useState<boolean>(false);
  const [vodNotes, setVodNotes] = useState<string>('');
  const [vodReviewStatus, setVodReviewStatus] = useState<'pending' | 'verified' | 'hidden' | 'deleted'>('pending');
  const [vodApprovedSourceType, setVodApprovedSourceType] = useState<'default_servers' | 'archive' | 'youtube' | null>(null);
  const [vodOverrideSaving, setVodOverrideSaving] = useState<boolean>(false);

  // كتالوج المحتوى العربي المباشر ونظام التدقيق
  const [arabicCatalogType, setArabicCatalogType] = useState<'series' | 'movies'>('series');
  const [arabicCatalogCategory, setArabicCatalogCategory] = useState<string>('all');
  const [arabicStatusFilter, setArabicStatusFilter] = useState<'all' | 'pending' | 'verified' | 'hidden' | 'deleted'>('all');
  const [arabicStatusCounts, setArabicStatusCounts] = useState<{
    all: number;
    pending: number;
    verified: number;
    hidden: number;
    deleted: number;
  }>({ all: 0, pending: 0, verified: 0, hidden: 0, deleted: 0 });
  const [arabicCatalogItems, setArabicCatalogItems] = useState<any[]>([]);
  const [arabicCatalogLoading, setArabicCatalogLoading] = useState<boolean>(false);
  const [arabicCatalogPage, setArabicCatalogPage] = useState<number>(1);
  const [arabicCatalogTotalPages, setArabicCatalogTotalPages] = useState<number>(1);

  // جلب مقترحات اليوتيوب التلقائية
  const [autoYoutubeLoading, setAutoYoutubeLoading] = useState<boolean>(false);
  const [autoYoutubeResults, setAutoYoutubeResults] = useState<
    Array<{
      id: string;
      title: string;
      url: string;
      embedUrl: string;
      label: string;
    }>
  >([]);

  // نافذة معاينة مشغلات VOD السريعة (VidLink / VidSrc / YouTube / Archive)
  const [vodPreviewModalVisible, setVodPreviewModalVisible] = useState<boolean>(false);
  const [vodPreviewUrl, setVodPreviewUrl] = useState<string>('');
  const [vodPreviewTitle, setVodPreviewTitle] = useState<string>('');

  // إدارة تخصيص القنوات المختارة والقنوات المضافة يدوياً
  const [channelOverrides, setChannelOverrides] = useState<ChannelOverrideItem[]>([]);
  const [channelOverridesLoading, setChannelOverridesLoading] = useState<boolean>(false);
  const [channelOverridesSaving, setChannelOverridesSaving] = useState<boolean>(false);

  const [showPickChannelModal, setShowPickChannelModal] = useState<boolean>(false);
  const [allM3uChannels, setAllM3uChannels] = useState<MediaItem[]>([]);
  const [allChannelsLoading, setAllChannelsLoading] = useState<boolean>(false);
  const [channelSearchQuery, setChannelSearchQuery] = useState<string>('');
  const [overrideFilterQuery, setOverrideFilterQuery] = useState<string>('');

  const [showEditChannelModal, setShowEditChannelModal] = useState<boolean>(false);
  const [editingChannel, setEditingChannel] = useState<{
    id: string;
    isCustom: boolean;
    name: string;
    logo: string;
    category: string;
    streamUrl: string;
    streamType: 'auto' | 'hls' | 'youtube' | 'iframe';
    isHidden: boolean;
    isDeleted: boolean;
    sortOrder: string;
  }>({
    id: '',
    isCustom: false,
    name: '',
    logo: '',
    category: '',
    streamUrl: '',
    streamType: 'auto',
    isHidden: false,
    isDeleted: false,
    sortOrder: '',
  });

  // إدارة سلاسل وباقات القنوات (Networks) عبر الـ Backend و D1
  const [adminNetworks, setAdminNetworks] = useState<ChannelNetwork[]>([]);
  const [adminNetworksLoading, setAdminNetworksLoading] = useState<boolean>(false);
  const [selectedNetworkForChannels, setSelectedNetworkForChannels] = useState<ChannelNetwork | null>(null);
  const [showNetworkChannelsModal, setShowNetworkChannelsModal] = useState<boolean>(false);
  const [editingNetwork, setEditingNetwork] = useState<{
    id: string;
    name: string;
    keywords: string;
    description: string;
    icon: string;
    sortOrder: string;
    isCustom: boolean;
  } | null>(null);
  const [showEditNetworkModal, setShowEditNetworkModal] = useState<boolean>(false);
  const [savingNetwork, setSavingNetwork] = useState<boolean>(false);

  const [customNetworks, setCustomNetworks] = useState<ChannelNetwork[]>([]);
  const [showAddNetworkModal, setShowAddNetworkModal] = useState<boolean>(false);
  const [newNetworkName, setNewNetworkName] = useState<string>('');
  const [newNetworkKeywords, setNewNetworkKeywords] = useState<string>('');
  const [newNetworkDesc, setNewNetworkDesc] = useState<string>('');

  // بيانات الأكواد
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    unused: 0,
    expired: 0,
    suspended: 0,
  });
  const [codes, setCodes] = useState<SubscriptionCode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // بيانات الموزعين
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [resellersLoading, setResellersLoading] = useState<boolean>(false);

  // فلاتر الأكواد
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'unused' | 'expired' | 'suspended'>('all');
  const [filterReseller, setFilterReseller] = useState<string>('all'); // 'all' | 'admin' | string(id)
  const [searchQuery, setSearchQuery] = useState<string>('');

  // نموذج توليد الأكواد
  const [genDuration, setGenDuration] = useState<number>(30);
  const [genMaxDevices, setGenMaxDevices] = useState<number>(1);
  const [genCount, setGenCount] = useState<number>(1);
  const [genNote, setGenNote] = useState<string>('');
  const [generatedBatch, setGeneratedBatch] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // نوافذ المودال للموزعين
  const [showAddResellerModal, setShowAddResellerModal] = useState<boolean>(false);
  const [showEditResellerModal, setShowEditResellerModal] = useState<boolean>(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);

  // حقول إضافة موزع جديد
  const [newResellerName, setNewResellerName] = useState<string>('');
  const [newResellerUsername, setNewResellerUsername] = useState<string>('');
  const [newResellerEmail, setNewResellerEmail] = useState<string>('');
  const [newResellerPassword, setNewResellerPassword] = useState<string>('');
  const [newResellerNote, setNewResellerNote] = useState<string>('');
  const [newResellerModalError, setNewResellerModalError] = useState<string | null>(null);

  // حقول تعديل موزع
  const [editResellerName, setEditResellerName] = useState<string>('');
  const [editResellerUsername, setEditResellerUsername] = useState<string>('');
  const [editResellerEmail, setEditResellerEmail] = useState<string>('');
  const [editResellerPassword, setEditResellerPassword] = useState<string>('');
  const [editResellerNote, setEditResellerNote] = useState<string>('');
  const [editResellerStatus, setEditResellerStatus] = useState<'active' | 'suspended'>('active');
  const [editResellerModalError, setEditResellerModalError] = useState<string | null>(null);

  // رؤوس الطلبات للمصادقة
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    if (adminKey) {
      headers['X-Admin-Key'] = adminKey;
    }
    return headers;
  }, [adminToken, adminKey]);

  // استرجاع الجلسة المحفوظة عند التحميل
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const savedToken = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
      const savedKey = window.sessionStorage.getItem(ADMIN_STORAGE_KEY);
      if (savedToken) {
        setAdminToken(savedToken);
        setIsAuthenticated(true);
      } else if (savedKey) {
        setAdminKey(savedKey);
        setIsAuthenticated(true);
      }
    }
  }, []);

  // جلب الأكواد
  const fetchCodes = useCallback(
    async (resellerParam?: string) => {
      if (!adminToken && !adminKey) return;
      setIsLoading(true);

      const targetReseller = resellerParam !== undefined ? resellerParam : filterReseller;
      const url = `${BACKEND_BASE_URL}/api/admin/codes?resellerId=${encodeURIComponent(targetReseller)}`;

      try {
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (res.status === 401) {
          setIsAuthenticated(false);
          setAuthError('انتهت صلاحية جلسة الإدارة، يرجى إعادة تسجيل الدخول');
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
          }
          return;
        }

        const data = await res.json();
        if (res.ok) {
          setStats(data.stats || { total: 0, active: 0, unused: 0, expired: 0, suspended: 0 });
          setCodes(data.codes || []);
        }
      } catch {
        setStatusMessage('تعذر جلب الأكواد من الخادم');
      } finally {
        setIsLoading(false);
      }
    },
    [adminToken, adminKey, filterReseller, getAuthHeaders]
  );

  // جلب الموزعين
  const fetchResellers = useCallback(async () => {
    if (!adminToken && !adminKey) return;
    setResellersLoading(true);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/resellers`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setResellers(data.resellers || []);
      }
    } catch {
      setStatusMessage('تعذر جلب قائمة الموزعين');
    } finally {
      setResellersLoading(false);
    }
  }, [adminToken, adminKey, getAuthHeaders]);

  // جلب إعدادات وسيرفرات الأفلام والمسلسلات
  const fetchVodSettings = useCallback(async () => {
    if (!adminToken && !adminKey) return;
    setVodLoading(true);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/vod-settings`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setVodSettings(data.settings);
        }
      }
    } catch {
      setStatusMessage('تعذر جلب إعدادات سيرفرات الأفلام');
    } finally {
      setVodLoading(false);
    }
  }, [adminToken, adminKey, getAuthHeaders]);

  // حفظ إعدادات وسيرفرات الأفلام والمسلسلات
  const handleSaveVodSettings = async () => {
    setVodSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/vod-settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(vodSettings),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setVodSettings(data.settings);
        }
        setStatusMessage('تم حفظ وتطبيق إعدادات سيرفرات الأفلام والمسلسلات بنجاح');
      } else {
        setStatusMessage('فشل حفظ إعدادات السيرفرات');
      }
    } catch {
      setStatusMessage('خطأ في الاتصال أثناء حفظ الإعدادات');
    } finally {
      setVodSaving(false);
    }
  };

  const toggleServerEnabled = (serverId: string) => {
    setVodSettings((prev) => ({
      ...prev,
      servers_priority: prev.servers_priority.map((srv) =>
        srv.id === serverId ? { ...srv, enabled: !srv.enabled } : srv
      ),
    }));
  };

  const moveServerPriority = (index: number, direction: 'up' | 'down') => {
    setVodSettings((prev) => {
      const list = [...prev.servers_priority];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...prev, servers_priority: list };
    });
  };

  // ==========================================
  // وظائف إدارة سلاسل وباقات القنوات (Networks)
  // ==========================================

  const fetchAdminNetworks = useCallback(async () => {
    setAdminNetworksLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/networks`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.networks)) {
          setAdminNetworks(data.networks);
        }
      }
    } catch (err) {
      console.warn('[Admin] Failed to fetch admin networks:', err);
    } finally {
      setAdminNetworksLoading(false);
    }
  }, [getAuthHeaders]);

  const handleCreateCustomNetwork = async () => {
    if (!newNetworkName.trim() || !newNetworkKeywords.trim()) {
      setStatusMessage('يرجى إدخال اسم الباقة والكلمات المفتاحية');
      return;
    }
    const keywords = newNetworkKeywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const payload = {
      name: newNetworkName.trim(),
      keywords,
      description: newNetworkDesc.trim() || 'باقة مخصصة مضافة من لوحة الإدارة',
      icon: 'hub',
      isCustom: true,
    };

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/networks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewNetworkName('');
        setNewNetworkKeywords('');
        setNewNetworkDesc('');
        setShowAddNetworkModal(false);
        setStatusMessage(`تمت إضافة "${payload.name}" بنجاح`);
        fetchAdminNetworks();
      } else {
        setStatusMessage(data.error || 'فشل حفظ الباقة المخصصة');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء حفظ الباقة');
    }
  };

  const handleToggleNetworkHidden = async (net: ChannelNetwork) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/networks/${encodeURIComponent(net.id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isHidden: !net.isHidden }),
      });
      if (res.ok) {
        setStatusMessage(!net.isHidden ? `تم إخفاء باقة "${net.name}" عن المستخدمين` : `تم إظهار باقة "${net.name}" للمستخدمين`);
        fetchAdminNetworks();
      }
    } catch {
      setStatusMessage('فشل تعديل حالة إخفاء الباقة');
    }
  };

  const handleDeleteNetwork = async (net: ChannelNetwork) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/networks/${encodeURIComponent(net.id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setStatusMessage(`تم حذف باقة "${net.name}" بنجاح`);
        fetchAdminNetworks();
      }
    } catch {
      setStatusMessage('فشل حذف الباقة');
    }
  };

  const handleSaveEditedNetwork = async () => {
    if (!editingNetwork) return;
    if (!editingNetwork.name.trim() || !editingNetwork.keywords.trim()) {
      setStatusMessage('يرجى إدخال اسم الباقة والكلمات المفتاحية');
      return;
    }
    setSavingNetwork(true);
    try {
      const keywords = editingNetwork.keywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const payload = {
        name: editingNetwork.name.trim(),
        keywords,
        description: editingNetwork.description.trim() || undefined,
        icon: editingNetwork.icon.trim() || 'hub',
        sortOrder: editingNetwork.sortOrder.trim() ? Number(editingNetwork.sortOrder.trim()) : undefined,
        isCustom: editingNetwork.isCustom,
      };

      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/networks/${encodeURIComponent(editingNetwork.id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowEditNetworkModal(false);
        setEditingNetwork(null);
        setStatusMessage('تم تعديل الباقة بنجاح');
        fetchAdminNetworks();
      } else {
        const d = await res.json();
        setStatusMessage(d.error || 'فشل تعديل الباقة');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء تعديل الباقة');
    } finally {
      setSavingNetwork(false);
    }
  };

  const handleOpenNetworkChannels = (net: ChannelNetwork) => {
    setSelectedNetworkForChannels(net);
    loadAllM3uChannels();
    setShowNetworkChannelsModal(true);
  };

  // ==========================================
  // وظائف إدارة المحتوى العربي VOD وربط Archive و YouTube
  // ==========================================

  const fetchVodOverrides = useCallback(async () => {
    setVodOverridesLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/vod/overrides`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setVodOverrides(Array.isArray(data.overrides) ? data.overrides : []);
      }
    } catch (err) {
      console.warn('[Admin] Failed to fetch VOD overrides:', err);
    } finally {
      setVodOverridesLoading(false);
    }
  }, [getAuthHeaders]);

  const handleSearchVod = async () => {
    const q = searchVodQuery.trim();
    if (!q) return;
    setSearchVodLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/vod/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const results = (data.results || []).map((item: any) => ({
          id: item.id,
          title: item.title || item.name,
          media_type: item.media_type || (item.first_air_date ? 'tv' : 'movie'),
          poster: item.poster || (item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : undefined),
          year: item.year || (item.release_date || item.first_air_date || '').substring(0, 4),
          overview: item.overview,
        }));
        setSearchVodResults(results);
      }
    } catch (err) {
      console.warn('[Admin] Failed to search VOD:', err);
    } finally {
      setSearchVodLoading(false);
    }
  };

  const handleCheckArchive = async (title: string) => {
    if (!title.trim()) return;
    setArchiveChecking(true);
    setArchiveResults([]);
    setArchiveCheckMessage(null);
    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/api/admin/vod/check-archive?title=${encodeURIComponent(title.trim())}`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        const list: ArchiveCheckResult[] = Array.isArray(data.results) ? data.results : [];
        setArchiveResults(list);
        if (list.length === 0) {
          setArchiveCheckMessage('لم يتم العثور على نتائج مطابقة مباشرة في Archive.org');
        } else {
          const recommended = list[0].recommendedUrl || list[0].directUrl || list[0].embedUrl;
          if (recommended && !vodArchiveUrl) {
            setVodArchiveUrl(recommended);
          }
        }
      } else {
        setArchiveCheckMessage('تعذر فحص Archive.org حالياً');
      }
    } catch {
      setArchiveCheckMessage('تعذر فحص Archive.org حالياً');
    } finally {
      setArchiveChecking(false);
    }
  };

  const getCleanTmdbId = (id: string | number) => {
    return String(id)
      .replace(/^tmdb-tv-/, '')
      .replace(/^tmdb-movie-/, '')
      .replace(/^tmdb-/, '')
      .replace(/-s\d+(-e\d+)?$/, '')
      .trim();
  };

  const getTargetOverrideKey = (
    item: VodSearchResult,
    season: number | null,
    episode: number | null
  ) => {
    const cleanId = getCleanTmdbId(item.id);
    const isTv =
      item.media_type === 'tv' ||
      String(item.id).startsWith('tmdb-tv-') ||
      String(item.id).includes('-s');
    if (!isTv) {
      return `tmdb-movie-${cleanId}`;
    }
    if (season !== null && episode !== null) {
      return `tmdb-tv-${cleanId}-s${season}-e${episode}`;
    }
    if (season !== null) {
      return `tmdb-tv-${cleanId}-s${season}`;
    }
    return `tmdb-tv-${cleanId}`;
  };

  const getTargetScopeTitle = (
    item: VodSearchResult,
    season: number | null,
    episode: number | null
  ) => {
    const baseTitle = item.title || item.name || '';
    const cleanTitle = baseTitle
      .replace(/\s*-\s*الموسم\s*\d+(\s*-\s*الحلقة\s*\d+)?/g, '')
      .replace(/\s*\(المسلسل كاملاً\)/g, '')
      .trim();
    const isTv =
      item.media_type === 'tv' ||
      String(item.id).startsWith('tmdb-tv-') ||
      String(item.id).includes('-s');
    if (!isTv) return cleanTitle;
    if (season !== null && episode !== null) {
      return `${cleanTitle} - الموسم ${season} - الحلقة ${episode}`;
    }
    if (season !== null) {
      return `${cleanTitle} - الموسم ${season}`;
    }
    return `${cleanTitle} (المسلسل كاملاً)`;
  };

  const parseOverrideScope = (tmdbId: string) => {
    const matchEp = tmdbId.match(/-s(\d+)-e(\d+)$/i);
    if (matchEp) {
      return {
        scope: 'episode' as const,
        season: parseInt(matchEp[1], 10),
        episode: parseInt(matchEp[2], 10),
        label: `الموسم ${matchEp[1]} • الحلقة ${matchEp[2]}`,
        isTv: true,
      };
    }
    const matchSeason = tmdbId.match(/-s(\d+)$/i);
    if (matchSeason) {
      return {
        scope: 'season' as const,
        season: parseInt(matchSeason[1], 10),
        episode: null,
        label: `الموسم ${matchSeason[1]} (كاملاً)`,
        isTv: true,
      };
    }
    if (String(tmdbId || '').includes('tv') || String(tmdbId || '').startsWith('tmdb-tv-')) {
      return {
        scope: 'series' as const,
        season: null,
        episode: null,
        label: 'المسلسل كاملاً',
        isTv: true,
      };
    }
    return {
      scope: 'movie' as const,
      season: null,
      episode: null,
      label: 'فيلم',
      isTv: false,
    };
  };

  const fetchTvSeasons = useCallback(
    async (cleanId: string) => {
      setTvSeasonsLoading(true);
      try {
        const res = await fetch(
          `${BACKEND_BASE_URL}/api/admin/vod/tv/${encodeURIComponent(cleanId)}/seasons`,
          { headers: getAuthHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          setTvSeasons(Array.isArray(data.seasons) ? data.seasons : []);
        } else {
          setTvSeasons([]);
        }
      } catch {
        setTvSeasons([]);
      } finally {
        setTvSeasonsLoading(false);
      }
    },
    [getAuthHeaders]
  );

  const fetchTvEpisodes = useCallback(
    async (cleanId: string, seasonNum: number) => {
      setTvEpisodesLoading(true);
      try {
        const res = await fetch(
          `${BACKEND_BASE_URL}/api/admin/vod/tv/${encodeURIComponent(cleanId)}/season/${seasonNum}`,
          { headers: getAuthHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          setTvEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
        } else {
          setTvEpisodes([]);
        }
      } catch {
        setTvEpisodes([]);
      } finally {
        setTvEpisodesLoading(false);
      }
    },
    [getAuthHeaders]
  );

  const applyOverrideFields = (key: string) => {
    const cleanKey = key.toLowerCase();
    const existing = vodOverrides.find((o) => {
      const k = o.tmdbId.toLowerCase();
      return k === cleanKey || k.replace(/^tmdb-tv-/, '') === cleanKey.replace(/^tmdb-tv-/, '');
    });
    if (existing) {
      setVodYoutubeUrl(existing.youtubeUrl || '');
      setVodYoutubePrimary(existing.useYoutubePrimary);
      setVodArchiveUrl(existing.archiveUrl || '');
      setVodArchivePrimary(existing.useArchivePrimary);
      setVodNotes(existing.notes || '');
      setVodReviewStatus(existing.reviewStatus || 'pending');
      setVodApprovedSourceType(existing.approvedSourceType || null);
    } else {
      setVodYoutubeUrl('');
      setVodYoutubePrimary(false);
      setVodArchiveUrl('');
      setVodArchivePrimary(false);
      setVodNotes('');
      setVodReviewStatus('pending');
      setVodApprovedSourceType(null);
    }
  };

  const handleAutoFetchYoutube = async (
    targetItem?: VodSearchResult,
    targetSeason?: number | null,
    targetEpisode?: number | null
  ) => {
    const item = targetItem || selectedVodItem;
    if (!item) return;
    setAutoYoutubeLoading(true);
    setAutoYoutubeResults([]);
    try {
      const isTv =
        item.media_type === 'tv' ||
        String(item.id).startsWith('tmdb-tv-') ||
        String(item.id).includes('-s');
      const baseTitle = item.title || item.name || '';
      const cleanTitle = baseTitle
        .replace(/\s*-\s*الموسم\s*\d+(\s*-\s*الحلقة\s*\d+)?/g, '')
        .replace(/\s*\(المسلسل كاملاً\)/g, '')
        .trim();
      const season = targetSeason !== undefined ? (targetSeason || 1) : (selectedSeason || 1);
      const episode = targetEpisode !== undefined ? (targetEpisode || 1) : (selectedEpisode || 1);
      const url = new URL(`${BACKEND_BASE_URL}/api/admin/vod/auto-youtube`);
      url.searchParams.set('title', cleanTitle);
      url.searchParams.set('type', isTv ? 'tv' : 'movie');
      if (isTv) {
        url.searchParams.set('season', String(season));
        url.searchParams.set('episode', String(episode));
      }
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data.results) ? data.results : [];
        const normalizedResults = results.map((r: any) => ({
          ...r,
          embedUrl: toYouTubeEmbedUrl(r.embedUrl || r.url),
          url: toYouTubeEmbedUrl(r.url || r.embedUrl),
        }));
        setAutoYoutubeResults(normalizedResults);
        if (normalizedResults.length > 0) {
          // عرض رابط اليوتيوب التلقائي مباشرة للأدمن في حقل الإدخال لتسهيل التجربة والمعاينة إن لم يكن هناك رابط مخصص مسبقاً
          setVodYoutubeUrl((prev) => (prev && prev.trim().length > 0 ? prev : normalizedResults[0].embedUrl));
          setStatusMessage(`تم العثور تلقائياً على ${normalizedResults.length} مقترح من YouTube`);
        } else {
          setStatusMessage('لم يُعثر على مقترحات YouTube تلقائية لهذا العمل');
        }
      } else {
        setStatusMessage('تعذر جلب مقترحات اليوتيوب');
      }
    } catch {
      setStatusMessage('تعذر الاتصال بخدمة فحص اليوتيوب');
    } finally {
      setAutoYoutubeLoading(false);
    }
  };

  const handleSelectVodItem = (
    item: VodSearchResult,
    initialSeason: number | null = null,
    initialEpisode: number | null = null
  ) => {
    setSelectedVodItem(item);
    setSelectedSeason(initialSeason);
    setSelectedEpisode(initialEpisode);

    const isTv =
      item.media_type === 'tv' ||
      String(item.id).startsWith('tmdb-tv-') ||
      String(item.id).includes('-s');
    const cleanId = getCleanTmdbId(item.id);

    if (isTv) {
      fetchTvSeasons(cleanId);
      if (initialSeason !== null) {
        fetchTvEpisodes(cleanId, initialSeason);
      } else {
        setTvEpisodes([]);
      }
    } else {
      setTvSeasons([]);
      setTvEpisodes([]);
    }

    const targetKey = getTargetOverrideKey(item, initialSeason, initialEpisode);
    applyOverrideFields(targetKey);

    const baseTitle = item.title || item.name || '';
    const cleanTitle = baseTitle
      .replace(/\s*-\s*الموسم\s*\d+(\s*-\s*الحلقة\s*\d+)?/g, '')
      .replace(/\s*\(المسلسل كاملاً\)/g, '')
      .trim();
    let archiveQuery = cleanTitle;
    if (isTv) {
      if (initialSeason !== null && initialEpisode !== null) {
        archiveQuery = `${cleanTitle} الجزء ${initialSeason} الحلقة ${initialEpisode}`;
      } else if (initialSeason !== null) {
        archiveQuery = `${cleanTitle} الموسم ${initialSeason}`;
      }
    }
    handleCheckArchive(archiveQuery);
    handleAutoFetchYoutube(item, initialSeason, initialEpisode);
  };

  const handleSeasonChange = (seasonNum: number | null) => {
    if (!selectedVodItem) return;
    setSelectedSeason(seasonNum);
    setSelectedEpisode(null);

    const cleanId = getCleanTmdbId(selectedVodItem.id);
    if (seasonNum !== null) {
      fetchTvEpisodes(cleanId, seasonNum);
    } else {
      setTvEpisodes([]);
    }

    const targetKey = getTargetOverrideKey(selectedVodItem, seasonNum, null);
    applyOverrideFields(targetKey);

    const baseTitle = selectedVodItem.title || selectedVodItem.name || '';
    const cleanTitle = baseTitle
      .replace(/\s*-\s*الموسم\s*\d+(\s*-\s*الحلقة\s*\d+)?/g, '')
      .replace(/\s*\(المسلسل كاملاً\)/g, '')
      .trim();
    const query = seasonNum !== null ? `${cleanTitle} الموسم ${seasonNum}` : cleanTitle;
    handleCheckArchive(query);
    handleAutoFetchYoutube(selectedVodItem, seasonNum, null);
  };

  const handleEpisodeChange = (epNum: number | null) => {
    if (!selectedVodItem) return;
    setSelectedEpisode(epNum);

    const targetKey = getTargetOverrideKey(selectedVodItem, selectedSeason, epNum);
    applyOverrideFields(targetKey);

    const baseTitle = selectedVodItem.title || selectedVodItem.name || '';
    const cleanTitle = baseTitle
      .replace(/\s*-\s*الموسم\s*\d+(\s*-\s*الحلقة\s*\d+)?/g, '')
      .replace(/\s*\(المسلسل كاملاً\)/g, '')
      .trim();
    const query =
      epNum !== null && selectedSeason !== null
        ? `${cleanTitle} الجزء ${selectedSeason} الحلقة ${epNum}`
        : selectedSeason !== null
        ? `${cleanTitle} الموسم ${selectedSeason}`
        : cleanTitle;
    handleCheckArchive(query);
    handleAutoFetchYoutube(selectedVodItem, selectedSeason, epNum);
  };

  const fetchArabicCatalog = useCallback(
    async (
      page: number = 1,
      type: 'series' | 'movies' = arabicCatalogType,
      category: string = arabicCatalogCategory,
      status: string = arabicStatusFilter,
      query: string = searchVodQuery
    ) => {
      setArabicCatalogLoading(true);
      try {
        const url = new URL(`${BACKEND_BASE_URL}/api/admin/vod/arabic-catalog`);
        url.searchParams.set('type', type);
        url.searchParams.set('category', category);
        url.searchParams.set('status', status);
        url.searchParams.set('page', String(page));
        if (query.trim()) {
          url.searchParams.set('q', query.trim());
        }
        const res = await fetch(url.toString(), {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setArabicCatalogItems(Array.isArray(data.results) ? data.results : []);
          setArabicCatalogPage(data.page || 1);
          setArabicCatalogTotalPages(data.totalPages || 1);
          if (data.statusCounts) {
            setArabicStatusCounts(data.statusCounts);
          }
        }
      } catch (err) {
        console.warn('[Admin] Failed to fetch arabic catalog:', err);
      } finally {
        setArabicCatalogLoading(false);
      }
    },
    [getAuthHeaders, arabicCatalogType, arabicCatalogCategory, arabicStatusFilter, searchVodQuery]
  );

  const handleSaveVodOverride = async (options?: {
    forceArchivePrimary?: boolean;
    forceYoutubePrimary?: boolean;
    customReviewStatus?: 'pending' | 'verified' | 'hidden' | 'deleted';
    customApprovedSourceType?: 'default_servers' | 'archive' | 'youtube' | null;
    customYoutubeUrl?: string;
  }) => {
    if (!selectedVodItem) return;
    setVodOverrideSaving(true);
    try {
      let ytPrimary = vodYoutubePrimary;
      let arPrimary = vodArchivePrimary;
      if (options?.forceArchivePrimary) {
        arPrimary = true;
        ytPrimary = false;
        setVodArchivePrimary(true);
        setVodYoutubePrimary(false);
      } else if (options?.forceYoutubePrimary) {
        ytPrimary = true;
        arPrimary = false;
        setVodYoutubePrimary(true);
        setVodArchivePrimary(false);
      }

      const reviewStatus = options?.customReviewStatus || vodReviewStatus || 'pending';
      const approvedSourceType =
        options?.customApprovedSourceType !== undefined
          ? options.customApprovedSourceType
          : vodApprovedSourceType;
      const rawYoutube =
        options?.customYoutubeUrl !== undefined
          ? options.customYoutubeUrl
          : vodYoutubeUrl.trim() || null;
      const effectiveYoutubeUrl = rawYoutube ? toYouTubeEmbedUrl(rawYoutube) : null;

      const targetKey = getTargetOverrideKey(selectedVodItem, selectedSeason, selectedEpisode);
      const targetTitle = getTargetScopeTitle(selectedVodItem, selectedSeason, selectedEpisode);
      const isTv =
        selectedVodItem.media_type === 'tv' ||
        String(selectedVodItem.id).startsWith('tmdb-tv-') ||
        String(selectedVodItem.id).includes('-s');

      const payload = {
        tmdbId: targetKey,
        title: targetTitle,
        mediaType: isTv ? 'tv' : 'movie',
        youtubeUrl: effectiveYoutubeUrl,
        useYoutubePrimary: ytPrimary,
        archiveUrl: vodArchiveUrl.trim() || null,
        useArchivePrimary: arPrimary,
        notes: vodNotes.trim() || null,
        reviewStatus,
        approvedSourceType,
      };

      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/vod/overrides`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setVodReviewStatus(reviewStatus);
        setVodApprovedSourceType(approvedSourceType);
        setStatusMessage(`تم حفظ استثناء "${payload.title}" وتطبيقه بنجاح`);
        fetchVodOverrides();
        fetchArabicCatalog(arabicCatalogPage);
      } else {
        const data = await res.json();
        setStatusMessage(data.error || 'فشل حفظ الاعتماد');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء حفظ الاعتماد');
    } finally {
      setVodOverrideSaving(false);
    }
  };

  const handleApproveDefaultServers = async () => {
    await handleSaveVodOverride({
      customReviewStatus: 'verified',
      customApprovedSourceType: 'default_servers',
      forceYoutubePrimary: false,
      forceArchivePrimary: false,
    });
  };

  const handleApproveYoutubeCandidate = async (candidateUrl: string) => {
    const cleanUrl = toYouTubeEmbedUrl(candidateUrl);
    setVodYoutubeUrl(cleanUrl);
    setVodYoutubePrimary(true);
    setVodArchivePrimary(false);
    await handleSaveVodOverride({
      customYoutubeUrl: cleanUrl,
      forceYoutubePrimary: true,
      customReviewStatus: 'verified',
      customApprovedSourceType: 'youtube',
    });
  };

  const handleToggleHide = async () => {
    const newStatus = vodReviewStatus === 'hidden' ? 'pending' : 'hidden';
    await handleSaveVodOverride({
      customReviewStatus: newStatus,
    });
  };

  const handleToggleDelete = async () => {
    const newStatus = vodReviewStatus === 'deleted' ? 'pending' : 'deleted';
    await handleSaveVodOverride({
      customReviewStatus: newStatus,
    });
  };

  const handleDeleteVodOverride = async (targetKey: string) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/vod/overrides/${encodeURIComponent(targetKey)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setStatusMessage('تم إلغاء الاستثناء واستعادة المصادر الافتراضية بنجاح');
        if (selectedVodItem) {
          const currentKey = getTargetOverrideKey(selectedVodItem, selectedSeason, selectedEpisode);
          if (currentKey.toLowerCase() === targetKey.toLowerCase()) {
            setVodYoutubeUrl('');
            setVodYoutubePrimary(false);
            setVodArchiveUrl('');
            setVodArchivePrimary(false);
            setVodNotes('');
          }
        }
        fetchVodOverrides();
      } else {
        setStatusMessage('فشل إلغاء الاعتماد');
      }
    } catch {
      setStatusMessage('فشل إلغاء الاعتماد');
    }
  };

  const handlePreviewVodServer = (server: 'vidlink' | 'vidsrc' | 'youtube' | 'archive') => {
    if (!selectedVodItem) return;
    const isTv =
      selectedVodItem.media_type === 'tv' ||
      String(selectedVodItem.id).startsWith('tmdb-tv-') ||
      String(selectedVodItem.id).includes('-s');
    const cleanId = getCleanTmdbId(selectedVodItem.id);
    const seasonNum = selectedSeason !== null ? selectedSeason : 1;
    const epNum = selectedEpisode !== null ? selectedEpisode : 1;

    let url = '';
    let name = '';

    if (server === 'vidlink') {
      name = 'VidLink';
      url = isTv
        ? `https://api.vidlink.pro/tv/${cleanId}/${seasonNum}/${epNum}`
        : `https://api.vidlink.pro/movie/${cleanId}`;
    } else if (server === 'vidsrc') {
      name = 'VidSrc CC';
      url = isTv
        ? `https://vidsrc.cc/v2/embed/tv/${cleanId}/${seasonNum}/${epNum}`
        : `https://vidsrc.cc/v2/embed/movie/${cleanId}`;
    } else if (server === 'youtube') {
      name = 'YouTube';
      url = vodYoutubeUrl.trim() || (autoYoutubeResults[0]?.embedUrl || autoYoutubeResults[0]?.url) || '';
      url = toYouTubeEmbedUrl(url);
    } else if (server === 'archive') {
      name = 'Archive.org';
      url = vodArchiveUrl;
    }

    if (!url) {
      setStatusMessage('لا يوجد رابط متاح للمعاينة');
      return;
    }

    const scopeTitle = getTargetScopeTitle(selectedVodItem, selectedSeason, selectedEpisode);
    setVodPreviewTitle(`${name}: ${scopeTitle}`);
    setVodPreviewUrl(toYouTubeEmbedUrl(url));
    setVodPreviewModalVisible(true);
  };

  // ==========================================
  // وظائف إدارة تخصيص القنوات (Channel Overrides)
  // ==========================================

  const fetchChannelOverrides = useCallback(async () => {
    setChannelOverridesLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/channels/overrides`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setChannelOverrides(Array.isArray(data.overrides) ? data.overrides : []);
      }
    } catch (err) {
      console.warn('[Admin] Failed to fetch channel overrides:', err);
    } finally {
      setChannelOverridesLoading(false);
    }
  }, [getAuthHeaders]);

  const loadAllM3uChannels = useCallback(async () => {
    if (allM3uChannels.length > 0) return;
    setAllChannelsLoading(true);
    try {
      const items = await fetchBackendPlaylist(false, adminToken);
      setAllM3uChannels(items.filter((it) => it.type !== 'movie' && it.type !== 'series'));
    } catch (err) {
      console.warn('[Admin] Failed to load M3U channels:', err);
    } finally {
      setAllChannelsLoading(false);
    }
  }, [allM3uChannels.length, adminToken]);

  const handleOpenPickChannelModal = () => {
    setChannelSearchQuery('');
    setShowPickChannelModal(true);
    loadAllM3uChannels();
  };

  const handleSelectChannelToOverride = (channel: MediaItem) => {
    const existing = channelOverrides.find((o) => o.id.toLowerCase() === channel.id.toLowerCase());
    setEditingChannel({
      id: channel.id,
      isCustom: false,
      name: existing?.name || channel.name,
      logo: existing?.logo || channel.logo || '',
      category: existing?.category || channel.groupTitle || '',
      streamUrl: existing?.streamUrl || channel.url || '',
      streamType: (existing?.streamType as any) || (channel.streamType as any) || 'auto',
      isHidden: existing?.isHidden ?? false,
      isDeleted: existing?.isDeleted ?? false,
      sortOrder: existing?.sortOrder !== null && existing?.sortOrder !== undefined ? String(existing.sortOrder) : '',
    });
    setShowPickChannelModal(false);
    setShowEditChannelModal(true);
  };

  const handleOpenAddCustomChannel = () => {
    setEditingChannel({
      id: '',
      isCustom: true,
      name: '',
      logo: '',
      category: 'قنوات عامة ومنوعة',
      streamUrl: '',
      streamType: 'auto',
      isHidden: false,
      isDeleted: false,
      sortOrder: '',
    });
    setShowEditChannelModal(true);
  };

  const handleSaveChannelOverride = async () => {
    if (!editingChannel.name.trim()) {
      setStatusMessage('يرجى إدخال اسم القناة');
      return;
    }
    if (!editingChannel.streamUrl.trim()) {
      setStatusMessage('يرجى إدخال رابط البث للقناة');
      return;
    }

    setChannelOverridesSaving(true);
    try {
      const payload = {
        id: editingChannel.id || undefined,
        name: editingChannel.name.trim(),
        logo: editingChannel.logo.trim() || null,
        category: editingChannel.category.trim() || null,
        streamUrl: editingChannel.streamUrl.trim(),
        streamType: editingChannel.streamType,
        isHidden: editingChannel.isHidden,
        isDeleted: editingChannel.isDeleted,
        sortOrder: editingChannel.sortOrder.trim() ? Number(editingChannel.sortOrder.trim()) : null,
        isCustom: editingChannel.isCustom,
      };

      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/channels/overrides`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowEditChannelModal(false);
        setStatusMessage(editingChannel.isCustom ? 'تمت إضافة القناة بنجاح' : 'تم حفظ تخصيص القناة بنجاح');
        fetchChannelOverrides();
      } else {
        setStatusMessage(data.error || 'فشل حفظ القناة');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء حفظ القناة');
    } finally {
      setChannelOverridesSaving(false);
    }
  };

  const handleDeleteChannelOverride = async (id: string, isCustom: boolean) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/channels/overrides/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(isCustom ? 'تم حذف القناة المضافة يدوياً' : 'تم إلغاء التخصيص واستعادة القناة الأصلية بنجاح');
        fetchChannelOverrides();
      }
    } catch {
      setStatusMessage('فشل إلغاء التخصيص');
    }
  };

  const handleToggleChannelHidden = async (item: ChannelOverrideItem) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/channels/overrides/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isHidden: !item.isHidden }),
      });
      if (res.ok) {
        setStatusMessage(!item.isHidden ? 'تم إخفاء القناة عن المستخدمين' : 'تم إظهار القناة للمستخدمين');
        fetchChannelOverrides();
      }
    } catch {
      setStatusMessage('فشل تعديل حالة الإخفاء');
    }
  };

  const handleToggleChannelDeleted = async (item: ChannelOverrideItem) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/channels/overrides/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isDeleted: !item.isDeleted }),
      });
      if (res.ok) {
        setStatusMessage(!item.isDeleted ? 'تم حذف القناة من العرض' : 'تمت استعادة القناة للعرض');
        fetchChannelOverrides();
      }
    } catch {
      setStatusMessage('فشل تعديل حالة الحذف');
    }
  };

  const handleMoveChannelPriority = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= channelOverrides.length) return;

    const list = [...channelOverrides];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const updatedItems = list.map((item, idx) => ({
      id: item.id,
      sortOrder: (idx + 1) * 10,
    }));

    setChannelOverrides(
      list.map((item, idx) => ({
        ...item,
        sortOrder: (idx + 1) * 10,
      }))
    );

    try {
      await fetch(`${BACKEND_BASE_URL}/api/admin/channels/overrides/reorder`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ items: updatedItems }),
      });
      setStatusMessage('تم تحديث ترتيب القنوات بنجاح');
    } catch (err) {
      console.warn('[Admin] Failed to reorder channel overrides:', err);
    }
  };

  const filteredSearchChannels = useMemo(() => {
    if (!channelSearchQuery.trim()) return allM3uChannels.slice(0, 50);
    const q = channelSearchQuery.trim().toLowerCase();
    return allM3uChannels
      .filter((c) => String(c?.name || '').toLowerCase().includes(q) || (c?.groupTitle && String(c.groupTitle).toLowerCase().includes(q)))
      .slice(0, 50);
  }, [allM3uChannels, channelSearchQuery]);

  const filteredOverridesList = useMemo(() => {
    if (!overrideFilterQuery.trim()) return channelOverrides;
    const q = overrideFilterQuery.trim().toLowerCase();
    return channelOverrides.filter(
      (c) =>
        (c?.name && String(c.name).toLowerCase().includes(q)) ||
        (c?.category && String(c.category).toLowerCase().includes(q)) ||
        String(c?.id || '').toLowerCase().includes(q)
    );
  }, [channelOverrides, overrideFilterQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'codes') {
        fetchCodes();
        fetchResellers(); // لجلب أسماء الموزعين في قائمة الاختيار
      } else if (activeTab === 'resellers') {
        fetchResellers();
      } else if (activeTab === 'vod') {
        fetchVodSettings();
      } else if (activeTab === 'arabic_vod') {
        fetchVodOverrides();
        fetchArabicCatalog(1);
      } else if (activeTab === 'networks') {
        fetchAdminNetworks();
      } else if (activeTab === 'channels') {
        fetchChannelOverrides();
      }
    }
  }, [
    isAuthenticated,
    activeTab,
    fetchCodes,
    fetchResellers,
    fetchVodSettings,
    fetchVodOverrides,
    fetchArabicCatalog,
    fetchAdminNetworks,
    fetchChannelOverrides,
  ]);

  // تسجيل الدخول للإدارة
  const handleLoginSubmit = async () => {
    const ident = identifierInput.trim();
    const pass = passwordInput.trim();

    if (!ident || !pass) {
      setAuthError('يرجى إدخال اسم المستخدم/البريد وكلمة المرور');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ident, password: pass }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        setAdminToken(data.token);
        setIsAuthenticated(true);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        }
      } else {
        // فحص التوافق العكسي إذا كان المستخدم يدخل مفتاح ADMIN_SECRET القديم
        const fallbackRes = await fetch(`${BACKEND_BASE_URL}/api/admin/codes`, {
          headers: { 'X-Admin-Key': pass || ident },
        });
        if (fallbackRes.ok) {
          setAdminKey(pass || ident);
          setIsAuthenticated(true);
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.sessionStorage.setItem(ADMIN_STORAGE_KEY, pass || ident);
          }
        } else {
          setAuthError(data.error || 'فشل تسجيل الدخول: بيانات غير صحيحة');
        }
      }
    } catch {
      setAuthError('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminToken('');
    setAdminKey('');
    setPasswordInput('');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  };

  // توليد الأكواد
  const handleGenerateCodes = async () => {
    setActionLoading('generate');
    setStatusMessage(null);
    setGeneratedBatch([]);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/codes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          durationDays: genDuration,
          maxDevices: genMaxDevices,
          count: genCount,
          note: genNote.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedBatch(data.codes || []);
        setStatusMessage(`تم توليد ${data.count} كود بنجاح!`);
        setGenNote('');
        fetchCodes();
        fetchResellers();
      } else {
        setStatusMessage(data.error || 'فشل توليد الأكواد');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء توليد الأكواد');
    } finally {
      setActionLoading(null);
    }
  };

  // نسخ كود
  const copyToClipboard = (text: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  // إجراءات تعديل كود
  const handleUpdateCode = async (
    code: string,
    payload: { status?: string; addDays?: number; resetDevices?: boolean; resellerId?: number | null }
  ) => {
    setActionLoading(code);
    setStatusMessage(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/codes/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(data.message || 'تم تحديث الكود بنجاح');
        fetchCodes();
        fetchResellers();
      } else {
        setStatusMessage(data.error || 'فشل تحديث الكود');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء التحديث');
    } finally {
      setActionLoading(null);
    }
  };

  // حذف كود نهائياً
  const handleDeleteCode = async (code: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`هل أنت متأكد من حذف الكود ${code} نهائياً؟`);
      if (!confirmed) return;
    }

    setActionLoading(code);
    setStatusMessage(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/codes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage('تم حذف الكود بنجاح');
        fetchCodes();
        fetchResellers();
      } else {
        setStatusMessage(data.error || 'فشل حذف الكود');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء الحذف');
    } finally {
      setActionLoading(null);
    }
  };

  // إنشاء موزع جديد
  const handleCreateResellerSubmit = async () => {
    if (!newResellerName.trim() || !newResellerUsername.trim() || !newResellerPassword.trim()) {
      setNewResellerModalError('يرجى ملء الاسم واسم المستخدم وكلمة المرور');
      return;
    }
    if (newResellerPassword.length < 6) {
      setNewResellerModalError('كلمة المرور يجب أن لا تقل عن 6 أحرف');
      return;
    }

    setActionLoading('create_reseller');
    setNewResellerModalError(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/resellers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newResellerName.trim(),
          username: newResellerUsername.trim(),
          email: newResellerEmail.trim() || null,
          password: newResellerPassword.trim(),
          note: newResellerNote.trim(),
          status: 'active',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddResellerModal(false);
        setNewResellerName('');
        setNewResellerUsername('');
        setNewResellerEmail('');
        setNewResellerPassword('');
        setNewResellerNote('');
        setStatusMessage('تم إنشاء حساب الموزع بنجاح');
        fetchResellers();
      } else {
        setNewResellerModalError(data.error || 'فشل إنشاء الموزع');
      }
    } catch {
      setNewResellerModalError('حدث خطأ أثناء إنشاء حساب الموزع');
    } finally {
      setActionLoading(null);
    }
  };

  // حفظ تعديلات موزع
  const handleEditResellerSubmit = async () => {
    if (!editingReseller) return;
    if (!editResellerName.trim() || !editResellerUsername.trim()) {
      setEditResellerModalError('يرجى إدخال اسم الموزع واسم المستخدم');
      return;
    }

    setActionLoading('edit_reseller');
    setEditResellerModalError(null);

    try {
      const payload: any = {
        name: editResellerName.trim(),
        username: editResellerUsername.trim(),
        email: editResellerEmail.trim() || null,
        note: editResellerNote.trim(),
        status: editResellerStatus,
      };

      if (editResellerPassword.trim().length >= 6) {
        payload.password = editResellerPassword.trim();
      }

      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/resellers/${editingReseller.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowEditResellerModal(false);
        setEditingReseller(null);
        setStatusMessage('تم تحديث بيانات الموزع بنجاح');
        fetchResellers();
      } else {
        setEditResellerModalError(data.error || 'فشل تحديث بيانات الموزع');
      }
    } catch {
      setEditResellerModalError('حدث خطأ أثناء تحديث الموزع');
    } finally {
      setActionLoading(null);
    }
  };

  // تبديل حالة الموزع (نشط / موقوف)
  const handleToggleResellerStatus = async (reseller: Reseller) => {
    const newStatus = reseller.status === 'active' ? 'suspended' : 'active';
    const actionText = newStatus === 'suspended' ? 'إيقاف' : 'تفعيل';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`هل أنت متأكد من ${actionText} حساب الموزع ${reseller.name}؟`);
      if (!confirmed) return;
    }

    setActionLoading(`toggle_reseller_${reseller.id}`);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/resellers/${reseller.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(`تم ${actionText} حساب الموزع بنجاح`);
        fetchResellers();
      } else {
        setStatusMessage(data.error || 'فشل تغيير حالة الموزع');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء تعديل الحالة');
    } finally {
      setActionLoading(null);
    }
  };

  // تصفية الأكواد محلياً بالبحث والحالة
  const filteredCodes = useMemo(() => {
    let result = codes;
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          String(c?.code || '').toLowerCase().includes(q) ||
          (c?.note && String(c.note).toLowerCase().includes(q)) ||
          (c?.resellerName && String(c.resellerName).toLowerCase().includes(q))
      );
    }
    return result;
  }, [codes, filterStatus, searchQuery]);

  // الانتقال للأكواد مفلترة بموزع معين
  const viewResellerCodes = (resellerId: number) => {
    setFilterReseller(String(resellerId));
    setActiveTab('codes');
    fetchCodes(String(resellerId));
  };

  // ==========================================
  // شاشة تسجيل دخول المشرف
  // ==========================================
  if (!isAuthenticated) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Image
            source={{ uri: '/icon.png' }}
            style={{ width: 64, height: 64, borderRadius: 14, alignSelf: 'center', marginBottom: 14 }}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff' }}>تلفازي</Text>
            <Text style={{ fontSize: 18, color: '#0EA5E9', fontWeight: '400' }}>|</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#94a3b8' }}>Telfazi</Text>
          </View>
          <Text style={styles.loginTitle}>لوحة إدارة المنصة</Text>
          <Text style={styles.loginSub}>
            إدارة الاشتراكات وأكواد التفعيل وشبكة الموزعين المعتمدين.
          </Text>

          <View style={styles.loginInputWrapper}>
            <MaterialIcons name="person" size={20} color="#94a3b8" />
            <TextInput
              style={styles.loginInput}
              value={identifierInput}
              onChangeText={setIdentifierInput}
              placeholder="اسم المستخدم أو البريد الإلكتروني"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.loginInputWrapper, { marginTop: 12 }]}>
            <MaterialIcons name="lock" size={20} color="#94a3b8" />
            <TextInput
              style={styles.loginInput}
              secureTextEntry
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder="كلمة المرور"
              placeholderTextColor="#64748b"
              onSubmitEditing={handleLoginSubmit}
            />
          </View>

          {authError && (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.loginButton, pressed && { opacity: 0.85 }]}
            onPress={handleLoginSubmit}
            disabled={authLoading}
          >
            {authLoading ? (
              <ActivityIndicator color="#070b14" size="small" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>تسجيل الدخول للإدارة</Text>
                <MaterialIcons name="arrow-back" size={20} color="#070b14" />
              </>
            )}
          </Pressable>

          <Pressable style={styles.backToHomeBtn} onPress={() => router.replace('/')}>
            <MaterialIcons name="home" size={18} color="#94a3b8" />
            <Text style={styles.backToHomeText}>العودة للواجهة الرئيسية</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ==========================================
  // الشاشة الرئيسية للوحة الإدارة
  // ==========================================
  return (
    <View style={styles.container}>
      {/* الشريط العلوي */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Image
            source={{ uri: '/icon.png' }}
            style={{ width: 44, height: 44, borderRadius: 10 }}
            resizeMode="contain"
          />
          <View style={styles.headerTitleRow}>
            <View style={styles.headerBadge}>
              <MaterialIcons name="verified-user" size={16} color="#f59e0b" />
              <Text style={styles.headerBadgeText}>تلفازي | لوحة تحكم المدير العام</Text>
            </View>
            <Text style={styles.headerMainTitle}>نظام إدارة المنصة والموزعين</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.refreshBtn}
            onPress={() => {
              if (activeTab === 'codes') fetchCodes();
              else if (activeTab === 'resellers') fetchResellers();
              else if (activeTab === 'vod') fetchVodSettings();
              else if (activeTab === 'arabic_vod') {
                fetchVodOverrides();
                fetchArabicCatalog(arabicCatalogPage);
              }
              else if (activeTab === 'networks') fetchAdminNetworks();
              else if (activeTab === 'channels') fetchChannelOverrides();
            }}
          >
            <MaterialIcons name="refresh" size={18} color="#38bdf8" />
            <Text style={styles.refreshBtnText}>تحديث</Text>
          </Pressable>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialIcons name="logout" size={18} color="#ef4444" />
            <Text style={styles.logoutBtnText}>خروج</Text>
          </Pressable>
        </View>
      </View>

      {/* تبويبات التنقل الرئيسية */}
      <View style={styles.mainNavTabs}>
        <Pressable
          style={[styles.mainNavTab, activeTab === 'codes' && styles.mainNavTabActive]}
          onPress={() => setActiveTab('codes')}
        >
          <MaterialIcons
            name="vpn-key"
            size={20}
            color={activeTab === 'codes' ? '#38bdf8' : '#94a3b8'}
          />
          <Text
            style={[styles.mainNavTabText, activeTab === 'codes' && styles.mainNavTabTextActive]}
          >
            الأكواد والاشتراكات ({stats.total})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.mainNavTab, activeTab === 'resellers' && styles.mainNavTabActive]}
          onPress={() => setActiveTab('resellers')}
        >
          <MaterialIcons
            name="group"
            size={20}
            color={activeTab === 'resellers' ? '#f59e0b' : '#94a3b8'}
          />
          <Text
            style={[
              styles.mainNavTabText,
              activeTab === 'resellers' && styles.mainNavTabTextActive,
            ]}
          >
            شبكة الموزعين ({resellers.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.mainNavTab, activeTab === 'vod' && styles.mainNavTabActive]}
          onPress={() => setActiveTab('vod')}
        >
          <MaterialIcons
            name="movie"
            size={20}
            color={activeTab === 'vod' ? '#ec4899' : '#94a3b8'}
          />
          <Text
            style={[
              styles.mainNavTabText,
              activeTab === 'vod' && styles.mainNavTabTextActive,
            ]}
          >
            سيرفرات الأفلام والمسلسلات
          </Text>
        </Pressable>

        <Pressable
          style={[styles.mainNavTab, activeTab === 'arabic_vod' && styles.mainNavTabActive]}
          onPress={() => setActiveTab('arabic_vod')}
        >
          <MaterialIcons
            name="movie-filter"
            size={20}
            color={activeTab === 'arabic_vod' ? '#06b6d4' : '#94a3b8'}
          />
          <Text
            style={[
              styles.mainNavTabText,
              activeTab === 'arabic_vod' && styles.mainNavTabTextActive,
            ]}
          >
            المحتوى العربي (VOD) ({vodOverrides.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.mainNavTab, activeTab === 'networks' && styles.mainNavTabActive]}
          onPress={() => setActiveTab('networks')}
        >
          <MaterialIcons
            name="hub"
            size={20}
            color={activeTab === 'networks' ? '#a855f7' : '#94a3b8'}
          />
          <Text
            style={[
              styles.mainNavTabText,
              activeTab === 'networks' && styles.mainNavTabTextActive,
            ]}
          >
            سلاسل وباقات القنوات ({adminNetworks.length > 0 ? adminNetworks.length : DEFAULT_NETWORKS.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.mainNavTab, activeTab === 'channels' && styles.mainNavTabActive]}
          onPress={() => setActiveTab('channels')}
        >
          <MaterialIcons
            name="live-tv"
            size={20}
            color={activeTab === 'channels' ? '#10b981' : '#94a3b8'}
          />
          <Text
            style={[
              styles.mainNavTabText,
              activeTab === 'channels' && styles.mainNavTabTextActive,
            ]}
          >
            إدارة القنوات ({channelOverrides.length})
          </Text>
        </Pressable>
      </View>

      {statusMessage && (
        <View style={styles.statusBar}>
          <MaterialIcons name="info" size={18} color="#38bdf8" />
          <Text style={styles.statusBarText}>{statusMessage}</Text>
          <Pressable onPress={() => setStatusMessage(null)}>
            <MaterialIcons name="close" size={18} color="#94a3b8" />
          </Pressable>
        </View>
      )}

      {/* محتوى التبويب */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'codes' ? (
          <>
            {/* بطاقات الإحصائيات العامة للأكواد */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderTopColor: '#38bdf8' }]}>
                <Text style={styles.statLabel}>إجمالي الأكواد</Text>
                <Text style={[styles.statValue, { color: '#38bdf8' }]}>{stats.total}</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#10b981' }]}>
                <Text style={styles.statLabel}>اشتراكات جارية</Text>
                <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.active}</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#f59e0b' }]}>
                <Text style={styles.statLabel}>أكواد جديدة غير مستخدمة</Text>
                <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.unused}</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#64748b' }]}>
                <Text style={styles.statLabel}>اشتراكات منتهية</Text>
                <Text style={[styles.statValue, { color: '#64748b' }]}>{stats.expired}</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#ef4444' }]}>
                <Text style={styles.statLabel}>موقوفة إدارياً</Text>
                <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.suspended}</Text>
              </View>
            </View>

            {/* نموذج توليد أكواد جديدة */}
            <View style={styles.cardSection}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="add-circle-outline" size={22} color="#38bdf8" />
                <Text style={styles.cardTitle}>توليد أكواد اشتراك جديدة</Text>
              </View>

              <View style={isWide ? styles.formGridWide : styles.formGridCol}>
                {/* الجهة المالكة للكود (تلقائية للقراءة فقط من الجلسة) */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>الجهة المالكة للكود (تلقائي):</Text>
                  <View style={styles.ownerAutoBadge}>
                    <MaterialIcons name="admin-panel-settings" size={20} color="#38bdf8" />
                    <Text style={styles.ownerAutoBadgeText}>الإدارة المباشرة</Text>
                    <View style={styles.autoTag}>
                      <Text style={styles.autoTagText}>تلقائي من الجلسة</Text>
                    </View>
                  </View>
                </View>

                {/* مدة الاشتراك */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>مدة الاشتراك:</Text>
                  <View style={styles.pillsRow}>
                    {[
                      { label: 'شهر (30 يوم)', val: 30 },
                      { label: '3 أشهر (90 يوم)', val: 90 },
                      { label: '6 أشهر (180 يوم)', val: 180 },
                      { label: 'سنة (365 يوم)', val: 365 },
                    ].map((item) => (
                      <Pressable
                        key={item.val}
                        style={[
                          styles.selectorPill,
                          genDuration === item.val && styles.selectorPillActive,
                        ]}
                        onPress={() => setGenDuration(item.val)}
                      >
                        <Text
                          style={[
                            styles.selectorPillText,
                            genDuration === item.val && styles.selectorPillTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* عدد الأجهزة والكمية */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>الحد الأقصى للأجهزة المتزامنة:</Text>
                  <View style={styles.pillsRow}>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <Pressable
                        key={num}
                        style={[
                          styles.selectorPillSmall,
                          genMaxDevices === num && styles.selectorPillActive,
                        ]}
                        onPress={() => setGenMaxDevices(num)}
                      >
                        <Text
                          style={[
                            styles.selectorPillText,
                            genMaxDevices === num && styles.selectorPillTextActive,
                          ]}
                        >
                          {num} {num === 1 ? 'جهاز' : 'أجهزة'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>الكمية المراد توليدها:</Text>
                  <View style={styles.pillsRow}>
                    {[1, 5, 10, 20, 50].map((num) => (
                      <Pressable
                        key={num}
                        style={[
                          styles.selectorPillSmall,
                          genCount === num && styles.selectorPillActive,
                        ]}
                        onPress={() => setGenCount(num)}
                      >
                        <Text
                          style={[
                            styles.selectorPillText,
                            genCount === num && styles.selectorPillTextActive,
                          ]}
                        >
                          {num} كود
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>ملاحظة / اسم المشترك (اختياري):</Text>
                  <TextInput
                    style={styles.textInput}
                    value={genNote}
                    onChangeText={setGenNote}
                    placeholder="مثال: اشتراك عائلي - أو اسم العميل"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.generateButton,
                  pressed && { opacity: 0.85 },
                  actionLoading === 'generate' && { opacity: 0.6 },
                ]}
                onPress={handleGenerateCodes}
                disabled={actionLoading === 'generate'}
              >
                {actionLoading === 'generate' ? (
                  <ActivityIndicator color="#070b14" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="auto-awesome" size={20} color="#070b14" />
                    <Text style={styles.generateButtonText}>
                      توليد {genCount} كود الآن ({genDuration} يوم)
                    </Text>
                  </>
                )}
              </Pressable>

              {/* الأكواد المولدة حديثاً */}
              {generatedBatch.length > 0 && (
                <View style={styles.batchContainer}>
                  <Text style={styles.batchTitle}>
                    الأكواد التي تم توليدها حديثاً ({generatedBatch.length}):
                  </Text>
                  <View style={styles.batchList}>
                    {generatedBatch.map((code) => (
                      <View key={code} style={styles.batchItem}>
                        <Text style={styles.batchCodeText}>{code}</Text>
                        <Pressable
                          style={[
                            styles.copyPill,
                            copiedCode === code && styles.copyPillSuccess,
                          ]}
                          onPress={() => copyToClipboard(code)}
                        >
                          <MaterialIcons
                            name={copiedCode === code ? 'check' : 'content-copy'}
                            size={16}
                            color={copiedCode === code ? '#10b981' : '#38bdf8'}
                          />
                          <Text
                            style={[
                              styles.copyPillText,
                              copiedCode === code && styles.copyPillTextSuccess,
                            ]}
                          >
                            {copiedCode === code ? 'تم النسخ!' : 'نسخ الكود'}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* أدوات البحث والفلترة */}
            <View style={styles.filterSection}>
              {/* فلتر الموزع */}
              <View style={styles.resellerFilterBar}>
                <Text style={styles.filterHeaderLabel}>عرض أكواد:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Pressable
                    style={[
                      styles.resellerPill,
                      filterReseller === 'all' && styles.resellerPillActive,
                    ]}
                    onPress={() => {
                      setFilterReseller('all');
                      fetchCodes('all');
                    }}
                  >
                    <Text
                      style={[
                        styles.resellerPillText,
                        filterReseller === 'all' && styles.resellerPillTextActive,
                      ]}
                    >
                      كافة الأكواد
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.resellerPill,
                      filterReseller === 'admin' && styles.resellerPillActive,
                    ]}
                    onPress={() => {
                      setFilterReseller('admin');
                      fetchCodes('admin');
                    }}
                  >
                    <Text
                      style={[
                        styles.resellerPillText,
                        filterReseller === 'admin' && styles.resellerPillTextActive,
                      ]}
                    >
                      أكواد الإدارة فقط
                    </Text>
                  </Pressable>
                  {resellers.map((r) => (
                    <Pressable
                      key={r.id}
                      style={[
                        styles.resellerPill,
                        filterReseller === String(r.id) && styles.resellerPillActive,
                      ]}
                      onPress={() => {
                        setFilterReseller(String(r.id));
                        fetchCodes(String(r.id));
                      }}
                    >
                      <Text
                        style={[
                          styles.resellerPillText,
                          filterReseller === String(r.id) && styles.resellerPillTextActive,
                        ]}
                      >
                        {r.name} ({r.stats?.total || 0})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* شريط البحث */}
              <View style={styles.searchBar}>
                <MaterialIcons name="search" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="ابحث عن كود، ملاحظة، أو اسم موزع..."
                  placeholderTextColor="#64748b"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <MaterialIcons name="close" size={18} color="#94a3b8" />
                  </Pressable>
                )}
              </View>

              {/* تبويبات حالة الكود */}
              <View style={styles.statusTabs}>
                {[
                  { key: 'all', label: 'الكل' },
                  { key: 'active', label: 'جارية' },
                  { key: 'unused', label: 'غير مستخدمة' },
                  { key: 'expired', label: 'منتهية' },
                  { key: 'suspended', label: 'موقوفة' },
                ].map((t) => (
                  <Pressable
                    key={t.key}
                    style={[
                      styles.statusTabPill,
                      filterStatus === t.key && styles.statusTabPillActive,
                    ]}
                    onPress={() => setFilterStatus(t.key as any)}
                  >
                    <Text
                      style={[
                        styles.statusTabPillText,
                        filterStatus === t.key && styles.statusTabPillTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* قائمة الأكواد */}
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>جاري جلب الأكواد...</Text>
              </View>
            ) : filteredCodes.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="inbox" size={48} color="#475569" />
                <Text style={styles.emptyText}>لا توجد أكواد مطابقة لخيارات البحث الحالية</Text>
              </View>
            ) : (
              <View style={styles.codesGrid}>
                {filteredCodes.map((item) => {
                  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                    active: { bg: '#064e3b', text: '#34d399', label: 'نشط وجاري' },
                    unused: { bg: '#451a03', text: '#fbbf24', label: 'غير مستخدم' },
                    expired: { bg: '#1e293b', text: '#94a3b8', label: 'منتهي' },
                    suspended: { bg: '#450a0a', text: '#f87171', label: 'موقوف' },
                  };
                  const curStatus = statusColors[item.status] || statusColors.unused;

                  return (
                    <View key={item.id} style={styles.codeCard}>
                      <View style={styles.codeCardTop}>
                        {/* الموزع المالك */}
                        <View style={styles.ownerBadge}>
                          <MaterialIcons
                            name={item.resellerName ? 'store' : 'admin-panel-settings'}
                            size={14}
                            color={item.resellerName ? '#f59e0b' : '#38bdf8'}
                          />
                          <Text
                            style={[
                              styles.ownerBadgeText,
                              { color: item.resellerName ? '#f59e0b' : '#38bdf8' },
                            ]}
                          >
                            {item.resellerName ? `الموزع: ${item.resellerName}` : 'الإدارة'}
                          </Text>
                        </View>

                        {/* شارة الحالة */}
                        <View style={[styles.badge, { backgroundColor: curStatus.bg }]}>
                          <Text style={[styles.badgeText, { color: curStatus.text }]}>
                            {curStatus.label}
                          </Text>
                        </View>
                      </View>

                      {/* الكود والنسخ */}
                      <View style={styles.codeMainRow}>
                        <Text style={styles.codeValueText}>{item.code}</Text>
                        <Pressable
                          style={[
                            styles.copyIconBtn,
                            copiedCode === item.code && styles.copyIconBtnSuccess,
                          ]}
                          onPress={() => copyToClipboard(item.code)}
                        >
                          <MaterialIcons
                            name={copiedCode === item.code ? 'check' : 'content-copy'}
                            size={18}
                            color={copiedCode === item.code ? '#10b981' : '#38bdf8'}
                          />
                        </Pressable>
                      </View>

                      {/* التفاصيل */}
                      <View style={styles.codeDetails}>
                        <View style={styles.detailRow}>
                          <MaterialIcons name="timer" size={16} color="#94a3b8" />
                          <Text style={styles.detailLabel}>المدة:</Text>
                          <Text style={styles.detailVal}>{item.durationDays} يوم</Text>
                          {item.status === 'active' && (
                            <Text style={styles.remainingVal}>
                              ({formatRemainingDaysArabic(getRemainingDays(item.expiresAt) || item.remainingDays, item.expiresAt)})
                            </Text>
                          )}
                        </View>

                        <View style={styles.detailRow}>
                          <MaterialIcons name="devices" size={16} color="#94a3b8" />
                          <Text style={styles.detailLabel}>الأجهزة:</Text>
                          <Text style={styles.detailVal}>
                            {item.deviceCount} من {item.maxDevices} مسموح
                          </Text>
                        </View>

                        {item.note ? (
                          <View style={styles.detailRow}>
                            <MaterialIcons name="notes" size={16} color="#94a3b8" />
                            <Text style={styles.detailLabel}>ملاحظة:</Text>
                            <Text style={styles.detailVal}>{item.note}</Text>
                          </View>
                        ) : null}

                        {item.expiresAt ? (
                          <View style={styles.detailRow}>
                            <MaterialIcons name="event" size={16} color="#94a3b8" />
                            <Text style={styles.detailLabel}>الانتهاء:</Text>
                            <Text style={styles.detailVal}>
                              {formatDateStandard(item.expiresAt)}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* أزرار الإجراءات السريعة */}
                      <View style={styles.codeActions}>
                        <Pressable
                          style={styles.actionBtnSmall}
                          onPress={() => handleUpdateCode(item.code, { addDays: 30 })}
                          disabled={actionLoading === item.code}
                        >
                          <MaterialIcons name="add-alarm" size={14} color="#38bdf8" />
                          <Text style={styles.actionBtnSmallText}>+30 يوم</Text>
                        </Pressable>

                        {item.status === 'suspended' ? (
                          <Pressable
                            style={[styles.actionBtnSmall, { borderColor: '#10b981' }]}
                            onPress={() => handleUpdateCode(item.code, { status: 'active' })}
                            disabled={actionLoading === item.code}
                          >
                            <MaterialIcons name="play-arrow" size={14} color="#10b981" />
                            <Text style={[styles.actionBtnSmallText, { color: '#10b981' }]}>
                              تفعيل
                            </Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.actionBtnSmall, { borderColor: '#ef4444' }]}
                            onPress={() => handleUpdateCode(item.code, { status: 'suspended' })}
                            disabled={actionLoading === item.code}
                          >
                            <MaterialIcons name="pause" size={14} color="#ef4444" />
                            <Text style={[styles.actionBtnSmallText, { color: '#ef4444' }]}>
                              إيقاف
                            </Text>
                          </Pressable>
                        )}

                        <Pressable
                          style={styles.actionBtnSmall}
                          onPress={() => handleUpdateCode(item.code, { resetDevices: true })}
                          disabled={actionLoading === item.code}
                        >
                          <MaterialIcons name={"restart-alt" as any} size={14} color="#f59e0b" />
                          <Text style={[styles.actionBtnSmallText, { color: '#f59e0b' }]}>
                            تصفير الأجهزة
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[styles.actionBtnSmall, { borderColor: '#b91c1c' }]}
                          onPress={() => handleDeleteCode(item.code)}
                          disabled={actionLoading === item.code}
                        >
                          <MaterialIcons name="delete" size={14} color="#f87171" />
                          <Text style={[styles.actionBtnSmallText, { color: '#f87171' }]}>حذف</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : activeTab === 'resellers' ? (
          /* ==========================================
             تبويب شبكة الموزعين (Resellers)
             ========================================== */
          <View style={styles.resellersTabContainer}>
            <View style={styles.resellersHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>الموزعون والوكلاء المعتمدون</Text>
                <Text style={styles.sectionHeaderSub}>
                  إدارة صلاحيات الموزعين ومتابعة مبيعاتهم واستهلاك الأكواد لكل موزع لحظياً.
                </Text>
              </View>

              <Pressable
                style={styles.addResellerBtn}
                onPress={() => {
                  setNewResellerModalError(null);
                  setShowAddResellerModal(true);
                }}
              >
                <MaterialIcons name="person-add" size={20} color="#070b14" />
                <Text style={styles.addResellerBtnText}>إضافة موزع جديد</Text>
              </Pressable>
            </View>

            {resellersLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingText}>جاري تحميل شبكة الموزعين...</Text>
              </View>
            ) : resellers.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="group-off" size={48} color="#475569" />
                <Text style={styles.emptyText}>لم يتم إضافة أي موزع حتى الآن</Text>
                <Pressable
                  style={[styles.addResellerBtn, { marginTop: 16 }]}
                  onPress={() => setShowAddResellerModal(true)}
                >
                  <MaterialIcons name="person-add" size={20} color="#070b14" />
                  <Text style={styles.addResellerBtnText}>إضافة أول موزع</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.resellersGrid}>
                {resellers.map((r) => {
                  const isActive = r.status === 'active';
                  return (
                    <View key={r.id} style={styles.resellerCard}>
                      <View style={styles.resellerCardHeader}>
                        <View style={styles.resellerAvatar}>
                          <MaterialIcons name="storefront" size={28} color="#f59e0b" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.resellerNameRow}>
                            <Text style={styles.resellerNameText}>{r.name}</Text>
                            <View
                              style={[
                                styles.resellerStatusBadge,
                                { backgroundColor: isActive ? '#064e3b' : '#450a0a' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.resellerStatusText,
                                  { color: isActive ? '#34d399' : '#f87171' },
                                ]}
                              >
                                {isActive ? 'نشط' : 'موقوف'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.resellerUsernameText}>@{r.username}</Text>
                          {r.email && <Text style={styles.resellerEmailText}>{r.email}</Text>}
                        </View>
                      </View>

                      {r.note ? (
                        <View style={styles.resellerNoteBox}>
                          <MaterialIcons name="info-outline" size={16} color="#94a3b8" />
                          <Text style={styles.resellerNoteText}>{r.note}</Text>
                        </View>
                      ) : null}

                      {/* إحصائيات الموزع */}
                      <View style={styles.resellerStatsBox}>
                        <View style={styles.resellerStatItem}>
                          <Text style={styles.resellerStatVal}>{r.stats?.total || 0}</Text>
                          <Text style={styles.resellerStatLbl}>إجمالي الأكواد</Text>
                        </View>
                        <View style={styles.resellerStatItem}>
                          <Text style={[styles.resellerStatVal, { color: '#10b981' }]}>
                            {r.stats?.active || 0}
                          </Text>
                          <Text style={styles.resellerStatLbl}>جارية</Text>
                        </View>
                        <View style={styles.resellerStatItem}>
                          <Text style={[styles.resellerStatVal, { color: '#fbbf24' }]}>
                            {r.stats?.unused || 0}
                          </Text>
                          <Text style={styles.resellerStatLbl}>غير مستخدمة</Text>
                        </View>
                        <View style={styles.resellerStatItem}>
                          <Text style={[styles.resellerStatVal, { color: '#94a3b8' }]}>
                            {r.stats?.expired || 0}
                          </Text>
                          <Text style={styles.resellerStatLbl}>منتهية</Text>
                        </View>
                        <View style={styles.resellerStatItem}>
                          <Text style={[styles.resellerStatVal, { color: '#f87171' }]}>
                            {r.stats?.suspended || 0}
                          </Text>
                          <Text style={styles.resellerStatLbl}>موقوفة</Text>
                        </View>
                      </View>

                      {/* أزرار الإجراءات على الموزع */}
                      <View style={styles.resellerActionsRow}>
                        <Pressable
                          style={styles.resellerActionBtnPrimary}
                          onPress={() => viewResellerCodes(r.id)}
                        >
                          <MaterialIcons name="list-alt" size={16} color="#38bdf8" />
                          <Text style={styles.resellerActionBtnPrimaryText}>عرض الأكواد</Text>
                        </Pressable>

                        <Pressable
                          style={styles.resellerActionBtnSecondary}
                          onPress={() => {
                            setEditingReseller(r);
                            setEditResellerName(r.name);
                            setEditResellerUsername(r.username);
                            setEditResellerEmail(r.email || '');
                            setEditResellerPassword('');
                            setEditResellerNote(r.note || '');
                            setEditResellerStatus(r.status);
                            setEditResellerModalError(null);
                            setShowEditResellerModal(true);
                          }}
                        >
                          <MaterialIcons name="edit" size={16} color="#e2e8f0" />
                          <Text style={styles.resellerActionBtnSecondaryText}>تعديل البيانات</Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.resellerActionBtnSecondary,
                            { borderColor: isActive ? '#ef4444' : '#10b981' },
                          ]}
                          onPress={() => handleToggleResellerStatus(r)}
                        >
                          <MaterialIcons
                            name={isActive ? 'block' : 'check-circle'}
                            size={16}
                            color={isActive ? '#f87171' : '#34d399'}
                          />
                          <Text
                            style={[
                              styles.resellerActionBtnSecondaryText,
                              { color: isActive ? '#f87171' : '#34d399' },
                            ]}
                          >
                            {isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : activeTab === 'vod' ? (
          /* ==========================================
             تبويب سيرفرات وإعدادات الأفلام والمسلسلات (VOD)
             ========================================== */
          <View style={styles.vodTabContainer}>
            <View style={styles.resellersHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>إعدادات سيرفرات الأفلام والمسلسلات</Text>
                <Text style={styles.sectionHeaderSub}>
                  التحكم في فحص السيرفرات اللحظي (Live Probe)، ترتيب أولوية السيرفرات، وتطبيق سياسة اليوتيوب الصارمة.
                </Text>
              </View>

              <Pressable
                style={[styles.saveVodBtn, vodSaving && { opacity: 0.7 }]}
                onPress={handleSaveVodSettings}
                disabled={vodSaving}
              >
                {vodSaving ? (
                  <ActivityIndicator color="#070b14" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={20} color="#070b14" />
                    <Text style={styles.saveVodBtnText}>حفظ وتطبيق الإعدادات</Text>
                  </>
                )}
              </Pressable>
            </View>

            {vodLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#ec4899" />
                <Text style={styles.loadingText}>جاري تحميل إعدادات سيرفرات الأفلام والمسلسلات...</Text>
              </View>
            ) : (
              <View style={styles.vodCardsStack}>
                {/* 1. بطاقة الفحص التلقائي اللحظي */}
                <View style={styles.vodCard}>
                  <View style={styles.vodCardHeader}>
                    <View style={styles.vodCardIconBox}>
                      <MaterialIcons name="speed" size={24} color="#38bdf8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vodCardTitle}>الفحص التلقائي اللحظي (Live Probe)</Text>
                      <Text style={styles.vodCardDesc}>
                        يقوم الخادم بفحص سيرفرات البث بالتوازي خلال ~2.8 ثانية والتأكد من إرجاع استجابة صالحة (HTTP 200) قبل تسليمها للمستخدم، لتفادي الروابط المعطلة أو صفحات 404.
                      </Text>
                    </View>
                    <Pressable
                      style={[
                        styles.toggleSwitchBtn,
                        vodSettings.live_probe_enabled
                          ? styles.toggleSwitchBtnActive
                          : styles.toggleSwitchBtnInactive,
                      ]}
                      onPress={() =>
                        setVodSettings((prev) => ({
                          ...prev,
                          live_probe_enabled: !prev.live_probe_enabled,
                        }))
                      }
                    >
                      <MaterialIcons
                        name={vodSettings.live_probe_enabled ? 'check-circle' : 'cancel'}
                        size={20}
                        color={vodSettings.live_probe_enabled ? '#10b981' : '#64748b'}
                      />
                      <Text
                        style={[
                          styles.toggleSwitchText,
                          vodSettings.live_probe_enabled && { color: '#10b981' },
                        ]}
                      >
                        {vodSettings.live_probe_enabled ? 'الفحص مفعّل' : 'الفحص معطّل'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* 2. بطاقة سياسة اليوتيوب */}
                <View style={styles.vodCard}>
                  <View style={styles.vodCardHeader}>
                    <View style={[styles.vodCardIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                      <MaterialIcons name="ondemand-video" size={24} color="#ef4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vodCardTitle}>سياسة مصادر يوتيوب والبدائل (Strict YouTube Policy)</Text>
                      <Text style={styles.vodCardDesc}>
                        تحديد متى يُسمح باستخدام يوتيوب كمصدر للبث، مع تطبيق سياسة الملاذ الأخير فقط.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.policyOptionsRow}>
                    <Pressable
                      style={[
                        styles.policyOptionCard,
                        vodSettings.youtube_policy === 'fallback_only' &&
                          styles.policyOptionCardActive,
                      ]}
                      onPress={() =>
                        setVodSettings((prev) => ({
                          ...prev,
                          youtube_policy: 'fallback_only',
                        }))
                      }
                    >
                      <View style={styles.policyOptionRadio}>
                        {vodSettings.youtube_policy === 'fallback_only' && (
                          <View style={styles.policyOptionRadioDot} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.policyOptionTitle}>ملاذ أخير فقط (Strict Fallback Only)</Text>
                        <Text style={styles.policyOptionSub}>
                          لا يظهر يوتيوب نهائياً طالما هناك سيرفر واحد على الأقل يعمل بنجاح. يُستعان به فقط وحصرياً إذا فشلت جميع السيرفرات الأساسية.
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.policyOptionCard,
                        vodSettings.youtube_policy === 'disabled' && styles.policyOptionCardActive,
                      ]}
                      onPress={() =>
                        setVodSettings((prev) => ({
                          ...prev,
                          youtube_policy: 'disabled',
                        }))
                      }
                    >
                      <View style={styles.policyOptionRadio}>
                        {vodSettings.youtube_policy === 'disabled' && (
                          <View style={styles.policyOptionRadioDot} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.policyOptionTitle}>تعطيل يوتيوب تماماً (Disabled)</Text>
                        <Text style={styles.policyOptionSub}>
                          حظر مصادر يوتيوب نهائياً والاعتماد حصرياً على سيرفرات البث المدمجة.
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                {/* 3. بطاقة ترتيب وأولوية السيرفرات */}
                <View style={styles.vodCard}>
                  <View style={styles.vodCardHeader}>
                    <View style={[styles.vodCardIconBox, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                      <MaterialIcons name="dns" size={24} color="#ec4899" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vodCardTitle}>ترتيب وأولوية سيرفرات البث المدمجة</Text>
                      <Text style={styles.vodCardDesc}>
                        يمكنك تغيير أولوية السيرفرات (السيرفر الأعلى يتم فحصه وتشغيله أولاً) وتفعيل أو تعطيل أي سيرفر حسب الحاجة.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.serverList}>
                    {vodSettings.servers_priority.map((srv, index) => (
                      <View key={srv.id} style={styles.serverRow}>
                        <View style={styles.serverRankBadge}>
                          <Text style={styles.serverRankText}>#{index + 1}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.serverName}>{srv.name}</Text>
                          <Text style={styles.serverIdText}>المعرف: {srv.id}</Text>
                        </View>

                        {/* زر التفعيل/التعطيل */}
                        <Pressable
                          style={[
                            styles.serverStatusBtn,
                            srv.enabled ? styles.serverStatusBtnActive : styles.serverStatusBtnInactive,
                          ]}
                          onPress={() => toggleServerEnabled(srv.id)}
                        >
                          <MaterialIcons
                            name={srv.enabled ? 'visibility' : 'visibility-off'}
                            size={16}
                            color={srv.enabled ? '#10b981' : '#64748b'}
                          />
                          <Text
                            style={[
                              styles.serverStatusBtnText,
                              srv.enabled && { color: '#10b981' },
                            ]}
                          >
                            {srv.enabled ? 'مفعّل' : 'معطّل'}
                          </Text>
                        </Pressable>

                        {/* أزرار التقديم والتأخير */}
                        <View style={styles.reorderBtns}>
                          <Pressable
                            style={[
                              styles.reorderBtn,
                              index === 0 && styles.reorderBtnDisabled,
                            ]}
                            disabled={index === 0}
                            onPress={() => moveServerPriority(index, 'up')}
                          >
                            <MaterialIcons
                              name="arrow-upward"
                              size={18}
                              color={index === 0 ? '#475569' : '#38bdf8'}
                            />
                          </Pressable>

                          <Pressable
                            style={[
                              styles.reorderBtn,
                              index === vodSettings.servers_priority.length - 1 &&
                                styles.reorderBtnDisabled,
                            ]}
                            disabled={index === vodSettings.servers_priority.length - 1}
                            onPress={() => moveServerPriority(index, 'down')}
                          >
                            <MaterialIcons
                              name="arrow-downward"
                              size={18}
                              color={
                                index === vodSettings.servers_priority.length - 1
                                  ? '#475569'
                                  : '#38bdf8'
                              }
                            />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* زر حفظ عريض إضافي في الأسفل */}
                <Pressable
                  style={[styles.saveVodBtnBottom, vodSaving && { opacity: 0.7 }]}
                  onPress={handleSaveVodSettings}
                  disabled={vodSaving}
                >
                  {vodSaving ? (
                    <ActivityIndicator color="#070b14" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="cloud-done" size={22} color="#070b14" />
                      <Text style={styles.saveVodBtnText}>حفظ وتطبيق إعدادات السيرفرات فوراً</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        ) : activeTab === 'arabic_vod' ? (
          /* ==========================================
             تبويب المحتوى العربي (VOD) ونظام التدقيق
             ========================================== */
          <View style={styles.vodTabContainer}>
            <View style={styles.resellersHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionHeaderTitle}>نظام تدقيق وإدارة المحتوى العربي (VOD)</Text>
                <Text style={styles.sectionHeaderSub}>
                  استعراض وتدقيق مسلسلات وأفلام الكتالوج العربي، فحص السيرفرات المدمجة، الاعتماد التلقائي من YouTube عند التعذر، وإدارة حالات الظهور للمستخدمين (دون المساس بالمحتوى غير العربي).
                </Text>
              </View>
            </View>

            {/* شريط التحكم الرئيسي في استعراض الكتالوج العربي */}
            <View style={[styles.vodSettingsCard, { marginBottom: 20 }]}>
              {/* التبديل الأساسي: مسلسلات عربية / أفلام عربية */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <Pressable
                  style={[
                    styles.primaryActionBtn,
                    {
                      flex: 1,
                      backgroundColor: arabicCatalogType === 'series' ? '#a855f7' : '#1e293b',
                      borderColor: arabicCatalogType === 'series' ? '#c084fc' : '#334155',
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => {
                    setArabicCatalogType('series');
                    setArabicCatalogCategory('all');
                    fetchArabicCatalog(1, 'series', 'all', arabicStatusFilter, searchVodQuery);
                  }}
                >
                  <MaterialIcons name="tv" size={20} color={arabicCatalogType === 'series' ? '#ffffff' : '#94a3b8'} />
                  <Text style={[styles.primaryActionBtnText, { color: arabicCatalogType === 'series' ? '#ffffff' : '#94a3b8' }]}>
                    المسلسلات العربية
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.primaryActionBtn,
                    {
                      flex: 1,
                      backgroundColor: arabicCatalogType === 'movies' ? '#06b6d4' : '#1e293b',
                      borderColor: arabicCatalogType === 'movies' ? '#38bdf8' : '#334155',
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => {
                    setArabicCatalogType('movies');
                    setArabicCatalogCategory('all');
                    fetchArabicCatalog(1, 'movies', 'all', arabicStatusFilter, searchVodQuery);
                  }}
                >
                  <MaterialIcons name="movie" size={20} color={arabicCatalogType === 'movies' ? '#ffffff' : '#94a3b8'} />
                  <Text style={[styles.primaryActionBtnText, { color: arabicCatalogType === 'movies' ? '#ffffff' : '#94a3b8' }]}>
                    الأفلام العربية
                  </Text>
                </Pressable>
              </View>

              {/* شريط التصنيفات (دراما، كوميديا، تاريخي...) */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6, fontWeight: '600' }}>
                  التصنيف:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(arabicCatalogType === 'series' ? ARABIC_SERIES_CATEGORIES : ARABIC_MOVIES_CATEGORIES).map((cat) => {
                      const isActive = arabicCatalogCategory === cat.id;
                      return (
                        <Pressable
                          key={cat.id}
                          style={[
                            styles.smallActionBtn,
                            isActive
                              ? { backgroundColor: '#06b6d4', borderColor: '#06b6d4' }
                              : { backgroundColor: '#1e293b', borderColor: '#334155' },
                          ]}
                          onPress={() => {
                            setArabicCatalogCategory(cat.id);
                            fetchArabicCatalog(1, arabicCatalogType, cat.id, arabicStatusFilter, searchVodQuery);
                          }}
                        >
                          <Text style={[styles.smallActionBtnText, { color: isActive ? '#ffffff' : '#cbd5e1' }]}>
                            {cat.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* شريط حالات التدقيق مع العدادات */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6, fontWeight: '600' }}>
                  تصفية بحسب حالة التدقيق:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                      { id: 'all', label: 'الكل', count: arabicStatusCounts.all, color: '#38bdf8' },
                      { id: 'pending', label: 'قيد المراجعة', count: arabicStatusCounts.pending, color: '#f59e0b' },
                      { id: 'verified', label: 'المدقّق / المعتمد', count: arabicStatusCounts.verified, color: '#10b981' },
                      { id: 'hidden', label: 'المخفي مؤقتاً', count: arabicStatusCounts.hidden, color: '#a855f7' },
                      { id: 'deleted', label: 'المحذوف', count: arabicStatusCounts.deleted, color: '#ef4444' },
                    ].map((st) => {
                      const isActive = arabicStatusFilter === st.id;
                      return (
                        <Pressable
                          key={st.id}
                          style={[
                            styles.smallActionBtn,
                            isActive
                              ? { backgroundColor: st.color, borderColor: st.color }
                              : { backgroundColor: '#1e293b', borderColor: '#334155' },
                          ]}
                          onPress={() => {
                            setArabicStatusFilter(st.id as any);
                            fetchArabicCatalog(1, arabicCatalogType, arabicCatalogCategory, st.id, searchVodQuery);
                          }}
                        >
                          <Text style={[styles.smallActionBtnText, { color: isActive ? '#070b14' : '#f1f5f9', fontWeight: '700' }]}>
                            {st.label} ({st.count})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* شريط البحث المباشر في الكتالوج */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="ابحث بالاسم داخل الكتالوج العربي..."
                  placeholderTextColor="#64748b"
                  value={searchVodQuery}
                  onChangeText={setSearchVodQuery}
                  onSubmitEditing={() => fetchArabicCatalog(1, arabicCatalogType, arabicCatalogCategory, arabicStatusFilter, searchVodQuery)}
                />
                <Pressable
                  style={[styles.primaryActionBtn, { backgroundColor: '#06b6d4', paddingHorizontal: 20 }]}
                  onPress={() => fetchArabicCatalog(1, arabicCatalogType, arabicCatalogCategory, arabicStatusFilter, searchVodQuery)}
                  disabled={arabicCatalogLoading}
                >
                  {arabicCatalogLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <MaterialIcons name="search" size={20} color="#ffffff" />
                      <Text style={styles.primaryActionBtnText}>بحث</Text>
                    </>
                  )}
                </Pressable>
                {searchVodQuery.trim().length > 0 && (
                  <Pressable
                    style={[styles.smallActionBtn, { borderColor: '#64748b', paddingHorizontal: 12 }]}
                    onPress={() => {
                      setSearchVodQuery('');
                      fetchArabicCatalog(1, arabicCatalogType, arabicCatalogCategory, arabicStatusFilter, '');
                    }}
                  >
                    <MaterialIcons name="close" size={18} color="#94a3b8" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* لوحة تفاصيل وتدقيق العمل المختار (تظهر عند اختيار أي عمل) */}
            {selectedVodItem && (
              <View style={[styles.vodSettingsCard, { borderColor: '#06b6d4', borderWidth: 2, marginBottom: 24, backgroundColor: '#0b1329' }]}>
                {/* رأس بطاقة العمل المختار */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                  {selectedVodItem.poster ? (
                    <Image source={{ uri: selectedVodItem.poster }} style={{ width: 70, height: 105, borderRadius: 8 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: 70, height: 105, borderRadius: 8, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name="movie" size={34} color="#64748b" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    {(() => {
                      const isTv =
                        selectedVodItem.media_type === 'tv' ||
                        String(selectedVodItem.id).startsWith('tmdb-tv-') ||
                        String(selectedVodItem.id).includes('-s');
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <Text style={[styles.cardHeaderTitle, { fontSize: 18, color: '#f8fafc' }]}>
                            {selectedVodItem.title || selectedVodItem.name}
                          </Text>
                          <View style={[styles.statusBadge, { backgroundColor: isTv ? '#a855f720' : '#06b6d420' }]}>
                            <Text style={[styles.statusBadgeText, { color: isTv ? '#c084fc' : '#06b6d4' }]}>
                              {isTv ? 'مسلسل عربي' : 'فيلم عربي'}
                            </Text>
                          </View>
                          {/* شارة حالة التدقيق الحالية */}
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor:
                                  vodReviewStatus === 'verified'
                                    ? '#10b98125'
                                    : vodReviewStatus === 'hidden'
                                    ? '#a855f725'
                                    : vodReviewStatus === 'deleted'
                                    ? '#ef444425'
                                    : '#f59e0b25',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                {
                                  color:
                                    vodReviewStatus === 'verified'
                                      ? '#10b981'
                                      : vodReviewStatus === 'hidden'
                                      ? '#c084fc'
                                      : vodReviewStatus === 'deleted'
                                      ? '#ef4444'
                                      : '#f59e0b',
                                  fontWeight: '700',
                                },
                              ]}
                            >
                              {vodReviewStatus === 'verified'
                                ? '✓ مدقّق ومعتمد'
                                : vodReviewStatus === 'hidden'
                                ? 'مخفي مؤقتاً'
                                : vodReviewStatus === 'deleted'
                                ? 'محذوف من القائمة'
                                : 'قيد المراجعة'}
                            </Text>
                          </View>
                          {vodApprovedSourceType && (
                            <View style={[styles.statusBadge, { backgroundColor: '#38bdf820' }]}>
                              <Text style={[styles.statusBadgeText, { color: '#38bdf8', fontSize: 11 }]}>
                                المصدر المعتمد: {vodApprovedSourceType === 'default_servers' ? 'سيرفرات مدمجة' : vodApprovedSourceType === 'youtube' ? 'يوتيوب' : 'أرشيف'}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                    <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                      معرّف TMDB: {getCleanTmdbId(selectedVodItem.id)} {selectedVodItem.year ? `| سنة الإنتاج: ${selectedVodItem.year}` : ''}
                    </Text>
                    {selectedVodItem.overview ? (
                      <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                        {selectedVodItem.overview}
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    style={[styles.smallActionBtn, { borderColor: '#64748b', alignSelf: 'flex-start' }]}
                    onPress={() => setSelectedVodItem(null)}
                  >
                    <MaterialIcons name="close" size={16} color="#94a3b8" />
                    <Text style={[styles.smallActionBtnText, { color: '#94a3b8' }]}>إغلاق لوحة التدقيق</Text>
                  </Pressable>
                </View>

                {/* واجهة اختيار وتحديد الموسم والحلقة للمسلسلات */}
                {Boolean(
                  selectedVodItem.media_type === 'tv' ||
                    String(selectedVodItem.id).startsWith('tmdb-tv-') ||
                    String(selectedVodItem.id).includes('-s')
                ) && (
                  <View style={{ marginTop: 16, padding: 14, backgroundColor: '#070b14', borderRadius: 10, borderWidth: 1, borderColor: '#1e293b' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <MaterialIcons name="subscriptions" size={20} color="#a855f7" />
                        <Text style={{ color: '#f8fafc', fontSize: 14, fontWeight: '700' }}>
                          نطاق التدقيق والتخصيص للمسلسل:
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: '#a855f720', borderColor: '#a855f7', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 }]}>
                        <Text style={[styles.statusBadgeText, { color: '#c084fc', fontWeight: '700' }]}>
                          {getTargetScopeTitle(selectedVodItem, selectedSeason, selectedEpisode)}
                        </Text>
                      </View>
                    </View>

                    {/* شريط اختيار الموسم */}
                    <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6, fontWeight: '600' }}>
                      1. اختر الموسم (أو اختر "المسلسل كاملاً" لتطبيق القرار على كافة الحلقات):
                    </Text>
                    {tvSeasonsLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                        <ActivityIndicator size="small" color="#a855f7" />
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>جارٍ جلب مواسم المسلسل...</Text>
                      </View>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable
                            style={[
                              styles.smallActionBtn,
                              selectedSeason === null
                                ? { backgroundColor: '#a855f7', borderColor: '#a855f7' }
                                : { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1e293b' },
                            ]}
                            onPress={() => handleSeasonChange(null)}
                          >
                            <Text style={[styles.smallActionBtnText, { color: selectedSeason === null ? '#ffffff' : '#cbd5e1' }]}>
                              المسلسل كاملاً
                            </Text>
                          </Pressable>

                          {tvSeasons.map((s) => {
                            const isSeasonActive = selectedSeason === s.seasonNumber;
                            const cleanId = getCleanTmdbId(selectedVodItem.id);
                            const hasSeasonOverride = vodOverrides.some((o) => {
                              const targetK = `tmdb-tv-${cleanId}-s${s.seasonNumber}`.toLowerCase();
                              const targetK2 = `${cleanId}-s${s.seasonNumber}`.toLowerCase();
                              return o.tmdbId.toLowerCase() === targetK || o.tmdbId.toLowerCase() === targetK2;
                            });

                            return (
                              <Pressable
                                key={s.seasonNumber}
                                style={[
                                  styles.smallActionBtn,
                                  isSeasonActive
                                    ? { backgroundColor: '#a855f7', borderColor: '#a855f7' }
                                    : { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1e293b' },
                                ]}
                                onPress={() => handleSeasonChange(s.seasonNumber)}
                              >
                                {hasSeasonOverride && (
                                  <MaterialIcons name="check-circle" size={13} color={isSeasonActive ? '#ffffff' : '#10b981'} />
                                )}
                                <Text style={[styles.smallActionBtnText, { color: isSeasonActive ? '#ffffff' : '#cbd5e1' }]}>
                                  الموسم {s.seasonNumber} {s.episodeCount ? `(${s.episodeCount} ح)` : ''}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </ScrollView>
                    )}

                    {/* شريط اختيار الحلقة */}
                    {selectedSeason !== null && (
                      <View style={{ marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6, fontWeight: '600' }}>
                          2. اختر الحلقة المحددة من الموسم {selectedSeason} (الحلقات ذات العلامة الخضراء مدققة/مخصصة مسبقاً):
                        </Text>
                        {tvEpisodesLoading ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                            <ActivityIndicator size="small" color="#06b6d4" />
                            <Text style={{ color: '#94a3b8', fontSize: 12 }}>جارٍ جلب حلقات الموسم {selectedSeason}...</Text>
                          </View>
                        ) : (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <Pressable
                                style={[
                                  styles.smallActionBtn,
                                  selectedEpisode === null
                                    ? { backgroundColor: '#06b6d4', borderColor: '#06b6d4' }
                                    : { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1e293b' },
                                ]}
                                onPress={() => handleEpisodeChange(null)}
                              >
                                <Text style={[styles.smallActionBtnText, { color: selectedEpisode === null ? '#ffffff' : '#cbd5e1' }]}>
                                  الموسم {selectedSeason} كاملاً
                                </Text>
                              </Pressable>

                              {tvEpisodes.map((ep) => {
                                const isEpActive = selectedEpisode === ep.episodeNumber;
                                const cleanId = getCleanTmdbId(selectedVodItem.id);
                                const hasEpOverride = vodOverrides.some((o) => {
                                  const targetK = `tmdb-tv-${cleanId}-s${selectedSeason}-e${ep.episodeNumber}`.toLowerCase();
                                  const targetK2 = `${cleanId}-s${selectedSeason}-e${ep.episodeNumber}`.toLowerCase();
                                  return o.tmdbId.toLowerCase() === targetK || o.tmdbId.toLowerCase() === targetK2;
                                });

                                return (
                                  <Pressable
                                    key={ep.episodeNumber}
                                    style={[
                                      styles.smallActionBtn,
                                      isEpActive
                                        ? { backgroundColor: '#06b6d4', borderColor: '#06b6d4' }
                                        : { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#1e293b' },
                                    ]}
                                    onPress={() => handleEpisodeChange(ep.episodeNumber)}
                                  >
                                    {hasEpOverride && (
                                      <MaterialIcons name="check-circle" size={13} color={isEpActive ? '#ffffff' : '#10b981'} />
                                    )}
                                    <Text style={[styles.smallActionBtnText, { color: isEpActive ? '#ffffff' : '#cbd5e1' }]}>
                                      الحلقة {ep.episodeNumber}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* الخطوة 1: فحص السيرفرات الافتراضية واعتمادها */}
                <View style={{ marginTop: 20, padding: 14, backgroundColor: '#070b14', borderRadius: 10, borderWidth: 1, borderColor: '#1e293b' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <MaterialIcons name="check-circle" size={20} color="#10b981" />
                    <Text style={[styles.modalLabel, { fontSize: 15, color: '#10b981', marginBottom: 0 }]}>
                      الخطوة 1: فحص سيرفرات المشاهدة المدمجة والأرشيف
                    </Text>
                  </View>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
                    تأكد من تشغيل العمل عبر أحد السيرفرات المدمجة (VidLink / VidSrc) أو Archive.org. إذا كان يعمل بشكل سليم، اعتمده مباشرة لنقله إلى «المدقّق»:
                  </Text>

                  {/* أزرار التجربة السريعة */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <Pressable
                      style={[styles.smallActionBtn, { backgroundColor: '#38bdf820', borderColor: '#38bdf8' }]}
                      onPress={() => handlePreviewVodServer('vidlink')}
                    >
                      <MaterialIcons name="play-arrow" size={16} color="#38bdf8" />
                      <Text style={[styles.smallActionBtnText, { color: '#38bdf8', fontWeight: '700' }]}>تجربة سيرفر VidLink</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.smallActionBtn, { backgroundColor: '#a855f720', borderColor: '#a855f7' }]}
                      onPress={() => handlePreviewVodServer('vidsrc')}
                    >
                      <MaterialIcons name="play-arrow" size={16} color="#c084fc" />
                      <Text style={[styles.smallActionBtnText, { color: '#c084fc', fontWeight: '700' }]}>تجربة سيرفر VidSrc CC</Text>
                    </Pressable>

                    {(vodYoutubeUrl.trim().length > 0 || autoYoutubeResults.length > 0) && (
                      <Pressable
                        style={[styles.smallActionBtn, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}
                        onPress={() => handlePreviewVodServer('youtube')}
                      >
                        <MaterialIcons name="play-arrow" size={16} color="#ef4444" />
                        <Text style={[styles.smallActionBtnText, { color: '#ef4444', fontWeight: '700' }]}>
                          تجربة مشغل YouTube {vodYoutubeUrl.trim().length > 0 ? '' : '(تلقائي)'}
                        </Text>
                      </Pressable>
                    )}

                    {autoYoutubeLoading && (
                      <View style={[styles.smallActionBtn, { backgroundColor: '#ef444410', borderColor: '#ef444440', gap: 6 }]}>
                        <ActivityIndicator size="small" color="#ef4444" />
                        <Text style={[styles.smallActionBtnText, { color: '#ef4444', fontSize: 11 }]}>جارٍ جلب YouTube...</Text>
                      </View>
                    )}

                    {vodArchiveUrl.trim().length > 0 && (
                      <Pressable
                        style={[styles.smallActionBtn, { backgroundColor: '#10b98120', borderColor: '#10b981' }]}
                        onPress={() => handlePreviewVodServer('archive')}
                      >
                        <MaterialIcons name="play-arrow" size={16} color="#10b981" />
                        <Text style={[styles.smallActionBtnText, { color: '#10b981', fontWeight: '700' }]}>تجربة رابط الأرشيف</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* زر الاعتماد البارز */}
                  <Pressable
                    style={[
                      styles.primaryActionBtn,
                      { backgroundColor: '#10b981', paddingVertical: 12, justifyContent: 'center' },
                      vodOverrideSaving && { opacity: 0.7 },
                    ]}
                    onPress={handleApproveDefaultServers}
                    disabled={vodOverrideSaving}
                  >
                    <MaterialIcons name="verified" size={20} color="#070b14" />
                    <Text style={[styles.primaryActionBtnText, { color: '#070b14', fontWeight: '800', fontSize: 14 }]}>
                      اعتماد السيرفرات الافتراضية (نقل إلى المدقّق والمعتمد)
                    </Text>
                  </Pressable>
                </View>

                {/* الخطوة 2: في حال تعذر السيرفرات المدمجة - الفحص التلقائي من YouTube */}
                <View style={{ marginTop: 16, padding: 14, backgroundColor: '#070b14', borderRadius: 10, borderWidth: 1, borderColor: '#ef444430' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialIcons name="smart-display" size={20} color="#ef4444" />
                      <Text style={[styles.modalLabel, { fontSize: 15, color: '#ef4444', marginBottom: 0 }]}>
                        الخطوة 2: في حال عدم عمل السيرفرات — جلب تلقائي من YouTube
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.smallActionBtn, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}
                      onPress={() => handleAutoFetchYoutube()}
                      disabled={autoYoutubeLoading}
                    >
                      {autoYoutubeLoading ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <>
                          <MaterialIcons name="auto-fix-high" size={16} color="#ef4444" />
                          <Text style={[styles.smallActionBtnText, { color: '#ef4444', fontWeight: '700' }]}>
                            جلب مقترحات اليوتيوب تلقائياً
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
                    يفحص نظام الذكاء تلقائياً حلقات المسلسل أو الفيلم على YouTube الرسمية مع التحقق من صلاحية التضمين:
                  </Text>

                  {/* نتائج الجلب التلقائي لليوتيوب */}
                  {autoYoutubeLoading ? (
                    <View style={{ padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                      <ActivityIndicator size="small" color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontSize: 13 }}>جارٍ البحث عن أفضل روابط YouTube المتطابقة...</Text>
                    </View>
                  ) : autoYoutubeResults.length > 0 ? (
                    <View style={{ gap: 8, marginBottom: 14 }}>
                      <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '700' }}>
                        المقترحات المتطابقة من YouTube ({autoYoutubeResults.length}):
                      </Text>
                      {autoYoutubeResults.map((yt, idx) => (
                        <View
                          key={idx}
                          style={{
                            backgroundColor: '#0f172a',
                            padding: 10,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#ef444440',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 220 }}>
                            <Text style={{ color: '#f8fafc', fontSize: 13, fontWeight: '600' }}>{yt.title}</Text>
                            <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                              {yt.url}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Pressable
                              style={[styles.smallActionBtn, { borderColor: '#ef4444' }]}
                              onPress={() => {
                                setVodPreviewTitle(`YouTube: ${yt.title}`);
                                setVodPreviewUrl(yt.embedUrl);
                                setVodPreviewModalVisible(true);
                              }}
                            >
                              <MaterialIcons name="play-arrow" size={14} color="#ef4444" />
                              <Text style={[styles.smallActionBtnText, { color: '#ef4444' }]}>معاينة</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.smallActionBtn, { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}
                              onPress={() => handleApproveYoutubeCandidate(yt.url)}
                            >
                              <MaterialIcons name="done" size={14} color="#ffffff" />
                              <Text style={[styles.smallActionBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                                اعتماد هذا الرابط (نقل للمدقّق)
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* إدخال رابط يوتيوب يدوي */}
                  <View style={{ marginTop: 4 }}>
                    <Text style={[styles.modalLabel, { fontSize: 12 }]}>أو أدخل رابط YouTube مخصص يدوياً:</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="https://www.youtube.com/watch?v=..."
                      placeholderTextColor="#64748b"
                      value={vodYoutubeUrl}
                      onChangeText={setVodYoutubeUrl}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        onPress={() => {
                          setVodYoutubePrimary(!vodYoutubePrimary);
                          if (!vodYoutubePrimary) setVodArchivePrimary(false);
                        }}
                      >
                        <MaterialIcons
                          name={vodYoutubePrimary ? 'check-box' : 'check-box-outline-blank'}
                          size={18}
                          color={vodYoutubePrimary ? '#ef4444' : '#64748b'}
                        />
                        <Text style={{ color: vodYoutubePrimary ? '#ef4444' : '#94a3b8', fontSize: 12, fontWeight: '600' }}>
                          تعيين YouTube كالمشغل الأساسي الأول لهذا النطاق
                        </Text>
                      </Pressable>

                      {vodYoutubeUrl.trim().length > 0 && (
                        <Pressable
                          style={[styles.smallActionBtn, { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}
                          onPress={() =>
                            handleSaveVodOverride({
                              forceYoutubePrimary: true,
                              customReviewStatus: 'verified',
                              customApprovedSourceType: 'youtube',
                            })
                          }
                          disabled={vodOverrideSaving}
                        >
                          <MaterialIcons name="done-all" size={14} color="#ffffff" />
                          <Text style={[styles.smallActionBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                            اعتماد الرابط اليدوي (نقل للمدقّق)
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>

                {/* فحص وإدخال رابط Archive.org اليدوي */}
                <View style={{ marginTop: 16, padding: 14, backgroundColor: '#070b14', borderRadius: 10, borderWidth: 1, borderColor: '#10b98130' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialIcons name="archive" size={20} color="#10b981" />
                      <Text style={[styles.modalLabel, { fontSize: 14, color: '#10b981', marginBottom: 0 }]}>
                        فحص ورابط Archive.org الرقمي
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.smallActionBtn, { borderColor: '#10b981' }]}
                      onPress={() => handleCheckArchive(selectedVodItem.title || selectedVodItem.name || '')}
                      disabled={archiveChecking}
                    >
                      {archiveChecking ? (
                        <ActivityIndicator size="small" color="#10b981" />
                      ) : (
                        <>
                          <MaterialIcons name="sync" size={14} color="#10b981" />
                          <Text style={[styles.smallActionBtnText, { color: '#10b981' }]}>فحص توفره في الأرشيف</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  <TextInput
                    style={styles.modalInput}
                    placeholder="https://archive.org/download/... أو https://archive.org/embed/..."
                    placeholderTextColor="#64748b"
                    value={vodArchiveUrl}
                    onChangeText={setVodArchiveUrl}
                  />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      onPress={() => {
                        setVodArchivePrimary(!vodArchivePrimary);
                        if (!vodArchivePrimary) setVodYoutubePrimary(false);
                      }}
                    >
                      <MaterialIcons
                        name={vodArchivePrimary ? 'check-box' : 'check-box-outline-blank'}
                        size={18}
                        color={vodArchivePrimary ? '#10b981' : '#64748b'}
                      />
                      <Text style={{ color: vodArchivePrimary ? '#10b981' : '#94a3b8', fontSize: 12, fontWeight: '600' }}>
                        تعيين الأرشيف كالمشغل الأساسي الأول
                      </Text>
                    </Pressable>

                    {vodArchiveUrl.trim().length > 0 && (
                      <Pressable
                        style={[styles.smallActionBtn, { backgroundColor: '#10b981', borderColor: '#10b981' }]}
                        onPress={() =>
                          handleSaveVodOverride({
                            forceArchivePrimary: true,
                            customReviewStatus: 'verified',
                            customApprovedSourceType: 'archive',
                          })
                        }
                        disabled={vodOverrideSaving}
                      >
                        <MaterialIcons name="done-all" size={14} color="#070b14" />
                        <Text style={[styles.smallActionBtnText, { color: '#070b14', fontWeight: '700' }]}>
                          اعتماد رابط الأرشيف (نقل للمدقّق)
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* إجراءات الحالة العامة وحفظ النطاق الحالي */}
                <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1e293b' }}>
                  <Text style={styles.modalLabel}>ملاحظات التدقيق (اختياري):</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="ملاحظات حول جودة المصدر أو الدقة..."
                    placeholderTextColor="#64748b"
                    value={vodNotes}
                    onChangeText={setVodNotes}
                  />

                  {/* أزرار الإجراءات السريعة (إخفاء مؤقت / حذف / حفظ) */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Pressable
                        style={[
                          styles.smallActionBtn,
                          {
                            backgroundColor: vodReviewStatus === 'hidden' ? '#a855f7' : '#a855f720',
                            borderColor: '#a855f7',
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                          },
                        ]}
                        onPress={handleToggleHide}
                        disabled={vodOverrideSaving}
                      >
                        <MaterialIcons
                          name={vodReviewStatus === 'hidden' ? 'visibility' : 'visibility-off'}
                          size={16}
                          color={vodReviewStatus === 'hidden' ? '#ffffff' : '#c084fc'}
                        />
                        <Text
                          style={[
                            styles.smallActionBtnText,
                            { color: vodReviewStatus === 'hidden' ? '#ffffff' : '#c084fc', fontWeight: '700' },
                          ]}
                        >
                          {vodReviewStatus === 'hidden' ? 'إعادة الإظهار للمستخدمين' : 'إخفاء مؤقت عن المستخدمين'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.smallActionBtn,
                          {
                            backgroundColor: vodReviewStatus === 'deleted' ? '#ef4444' : '#ef444420',
                            borderColor: '#ef4444',
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                          },
                        ]}
                        onPress={handleToggleDelete}
                        disabled={vodOverrideSaving}
                      >
                        <MaterialIcons
                          name={vodReviewStatus === 'deleted' ? 'restore' : 'delete'}
                          size={16}
                          color={vodReviewStatus === 'deleted' ? '#ffffff' : '#ef4444'}
                        />
                        <Text
                          style={[
                            styles.smallActionBtnText,
                            { color: vodReviewStatus === 'deleted' ? '#ffffff' : '#ef4444', fontWeight: '700' },
                          ]}
                        >
                          {vodReviewStatus === 'deleted' ? 'استعادة إلى القائمة' : 'حذف من القائمة'}
                        </Text>
                      </Pressable>
                    </View>

                    <Pressable
                      style={[styles.primaryActionBtn, { backgroundColor: '#06b6d4', paddingHorizontal: 24, paddingVertical: 10 }]}
                      onPress={() => handleSaveVodOverride()}
                      disabled={vodOverrideSaving}
                    >
                      {vodOverrideSaving ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <MaterialIcons name="save" size={18} color="#ffffff" />
                          <Text style={styles.primaryActionBtnText}>
                            حفظ واعتماد التعديلات
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* شبكة استعراض الكتالوج العربي المباشر */}
            <View style={{ marginBottom: 24 }}>
              <View style={[styles.resellersHeaderRow, { marginBottom: 12 }]}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>
                    {arabicCatalogType === 'series' ? 'قائمة المسلسلات العربية' : 'قائمة الأفلام العربية'} ({arabicCatalogItems.length})
                  </Text>
                  <Text style={styles.sectionHeaderSub}>
                    اضغط على أي بطاقة لبدء فحص السيرفرات وتدقيقها واعتمادها
                  </Text>
                </View>
              </View>

              {arabicCatalogLoading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#06b6d4" />
                  <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>جارٍ جلب الكتالوج العربي وحالات التدقيق...</Text>
                </View>
              ) : arabicCatalogItems.length === 0 ? (
                <View style={{ padding: 30, backgroundColor: '#0f172a', borderRadius: 12, alignItems: 'center' }}>
                  <MaterialIcons name="movie-filter" size={48} color="#334155" />
                  <Text style={{ color: '#94a3b8', fontSize: 15, marginTop: 12, fontWeight: '600' }}>
                    لا توجد أعمال مطابقة للفلاتر المحددة
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                  {arabicCatalogItems.map((item) => {
                    const isSelected = selectedVodItem?.id === item.id;
                    const stColor =
                      item.reviewStatus === 'verified'
                        ? '#10b981'
                        : item.reviewStatus === 'hidden'
                        ? '#a855f7'
                        : item.reviewStatus === 'deleted'
                        ? '#ef4444'
                        : '#f59e0b';
                    const stLabel =
                      item.reviewStatus === 'verified'
                        ? 'مدقّق'
                        : item.reviewStatus === 'hidden'
                        ? 'مخفي'
                        : item.reviewStatus === 'deleted'
                        ? 'محذوف'
                        : 'قيد المراجعة';

                    return (
                      <Pressable
                        key={item.id}
                        style={[
                          {
                            width: isWide ? '23.5%' : '47%',
                            backgroundColor: '#0f172a',
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: isSelected ? '#06b6d4' : '#1e293b',
                            overflow: 'hidden',
                          },
                          isSelected && { borderColor: '#06b6d4', shadowColor: '#06b6d4', shadowOpacity: 0.3, shadowRadius: 8 },
                        ]}
                        onPress={() => handleSelectVodItem(item)}
                      >
                        <View style={{ height: 210, width: '100%', position: 'relative', backgroundColor: '#1e293b' }}>
                          {item.poster ? (
                            <Image source={{ uri: item.poster }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          ) : (
                            <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                              <MaterialIcons name="movie" size={40} color="#475569" />
                            </View>
                          )}
                          {/* شارة حالة التدقيق */}
                          <View
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: stColor + 'dd',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>{stLabel}</Text>
                          </View>
                          {/* شارة المصدر المعتمد إن وجد */}
                          {item.approvedSourceType && (
                            <View
                              style={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#38bdf8',
                              }}
                            >
                              <Text style={{ color: '#38bdf8', fontSize: 10, fontWeight: '600' }}>
                                {item.approvedSourceType === 'default_servers' ? 'سيرفرات' : item.approvedSourceType === 'youtube' ? 'يوتيوب' : 'أرشيف'}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={{ padding: 10 }}>
                          <Text style={{ color: '#f8fafc', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <Text style={{ color: '#64748b', fontSize: 12 }}>{item.year || ''}</Text>
                            <Text style={{ color: '#06b6d4', fontSize: 11, fontWeight: '600' }}>
                              {isSelected ? 'قيد التدقيق الآن' : 'اضغط للتدقيق ←'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* عناصر التنقل بين الصفحات */}
              {arabicCatalogTotalPages > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 20 }}>
                  <Pressable
                    style={[styles.smallActionBtn, { paddingHorizontal: 16 }, arabicCatalogPage <= 1 && { opacity: 0.5 }]}
                    disabled={arabicCatalogPage <= 1 || arabicCatalogLoading}
                    onPress={() => fetchArabicCatalog(arabicCatalogPage - 1, arabicCatalogType, arabicCatalogCategory, arabicStatusFilter, searchVodQuery)}
                  >
                    <MaterialIcons name="chevron-right" size={20} color="#06b6d4" />
                    <Text style={[styles.smallActionBtnText, { color: '#06b6d4', fontWeight: '700' }]}>السابق</Text>
                  </Pressable>

                  <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>
                    صفحة {arabicCatalogPage} من {arabicCatalogTotalPages}
                  </Text>

                  <Pressable
                    style={[styles.smallActionBtn, { paddingHorizontal: 16 }, arabicCatalogPage >= arabicCatalogTotalPages && { opacity: 0.5 }]}
                    disabled={arabicCatalogPage >= arabicCatalogTotalPages || arabicCatalogLoading}
                    onPress={() => fetchArabicCatalog(arabicCatalogPage + 1, arabicCatalogType, arabicCatalogCategory, arabicStatusFilter, searchVodQuery)}
                  >
                    <Text style={[styles.smallActionBtnText, { color: '#06b6d4', fontWeight: '700' }]}>التالي</Text>
                    <MaterialIcons name="chevron-left" size={20} color="#06b6d4" />
                  </Pressable>
                </View>
              )}
            </View>

            {/* قائمة جميع الاستثناءات المعتمدة */}
            <View style={{ marginTop: 10 }}>
              <View style={styles.resellersHeaderRow}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>
                    الأعمال العربية المخصصة والمعتمدة مسبقاً ({vodOverrides.length})
                  </Text>
                  <Text style={styles.sectionHeaderSub}>
                    قائمة بالأفلام والمسلسلات العربية التي تم ربطها بروابط أرشيف أو يوتيوب محددة
                  </Text>
                </View>
              </View>

              {vodOverridesLoading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#06b6d4" />
                </View>
              ) : vodOverrides.length === 0 ? (
                <View style={{ padding: 30, backgroundColor: '#0f172a', borderRadius: 12, alignItems: 'center' }}>
                  <MaterialIcons name="movie-filter" size={48} color="#334155" />
                  <Text style={{ color: '#94a3b8', fontSize: 15, marginTop: 12, fontWeight: '600' }}>
                    لا توجد استثناءات مخصصة حالياً
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                    جميع الأعمال العربية تستخدم السيرفرات المدمجة التلقائية وفحص Archive.org الافتراضي. استخدم البحث أعلاه لتخصيص أي عمل.
                  </Text>
                </View>
              ) : (
                <View style={styles.resellersGrid}>
                  {vodOverrides.map((ov) => {
                    const scopeInfo = parseOverrideScope(ov.tmdbId);
                    return (
                      <View key={ov.tmdbId} style={[styles.resellerCard, { borderColor: '#06b6d4' }]}>
                        <View style={styles.resellerCardHeader}>
                          <View style={styles.resellerInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <MaterialIcons name={scopeInfo.isTv ? 'tv' : 'movie'} size={22} color="#06b6d4" />
                              <Text style={styles.resellerName}>{ov.title}</Text>
                            </View>
                            <Text style={styles.resellerUsername}>
                              معرّف TMDB: {ov.tmdbId} • {scopeInfo.label}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                            <View style={[styles.statusBadge, { backgroundColor: scopeInfo.isTv ? '#a855f720' : '#38bdf820' }]}>
                              <Text style={[styles.statusBadgeText, { color: scopeInfo.isTv ? '#c084fc' : '#38bdf8' }]}>
                                {scopeInfo.isTv ? 'مسلسل عربي' : 'فيلم عربي'}
                              </Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: '#06b6d420' }]}>
                              <Text style={[styles.statusBadgeText, { color: '#06b6d4' }]}>
                                {ov.useArchivePrimary ? 'الأرشيف أولاً' : ov.useYoutubePrimary ? 'يوتيوب أولاً' : 'سيرفرات مدمجة'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* تفاصيل المصادر */}
                        <View style={{ marginVertical: 8, padding: 10, backgroundColor: '#070b14', borderRadius: 8, gap: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialIcons name="filter-none" size={14} color="#a855f7" />
                            <Text style={{ color: '#c084fc', fontSize: 12, fontWeight: '700' }}>
                              نطاق التخصيص: {scopeInfo.label}
                            </Text>
                          </View>
                          {ov.archiveUrl ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <MaterialIcons name="archive" size={16} color="#10b981" />
                              <Text style={{ color: '#10b981', fontSize: 12, flex: 1 }} numberOfLines={1}>
                                الأرشيف: {ov.archiveUrl}
                              </Text>
                            </View>
                          ) : null}
                          {ov.youtubeUrl ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <MaterialIcons name="smart-display" size={16} color="#ef4444" />
                              <Text style={{ color: '#ef4444', fontSize: 12, flex: 1 }} numberOfLines={1}>
                                يوتيوب: {ov.youtubeUrl}
                              </Text>
                            </View>
                          ) : null}
                          {ov.notes ? (
                            <Text style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
                              ملاحظة: {ov.notes}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.resellerCardActions}>
                          <Pressable
                            style={[styles.resellerActionBtn, { backgroundColor: '#06b6d420', borderColor: '#06b6d4' }]}
                            onPress={() => {
                              handleSelectVodItem(
                                {
                                  id: ov.tmdbId,
                                  title: ov.title,
                                  media_type: scopeInfo.isTv ? 'tv' : 'movie',
                                },
                                scopeInfo.season,
                                scopeInfo.episode
                              );
                            }}
                          >
                            <MaterialIcons name="edit" size={16} color="#06b6d4" />
                            <Text style={[styles.resellerActionBtnText, { color: '#06b6d4' }]}>تعديل</Text>
                          </Pressable>

                          <Pressable
                            style={[styles.resellerActionBtnSecondary, { borderColor: '#ef4444' }]}
                            onPress={() => handleDeleteVodOverride(ov.tmdbId)}
                          >
                            <MaterialIcons name="delete" size={16} color="#ef4444" />
                            <Text style={[styles.resellerActionBtnSecondaryText, { color: '#ef4444' }]}>إلغاء الاعتماد</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        ) : activeTab === 'networks' ? (
          /* ==========================================
             تبويب سلاسل وباقات القنوات (Networks)
             ========================================== */
          <View style={styles.resellersTabContainer}>
            <View style={styles.resellersHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>سلاسل وباقات القنوات (Networks)</Text>
                <Text style={styles.sectionHeaderSub}>
                  إدارة وتخصيص باقات وسلاسل القنوات التلفزيونية والتحكم في ظهورها وإخفائها وحذفها، وتعديل وإخفاء القنوات التابعة لكل باقة مباشرة.
                </Text>
              </View>

              <Pressable
                style={[styles.primaryActionBtn, { backgroundColor: '#a855f7' }]}
                onPress={() => setShowAddNetworkModal(true)}
              >
                <MaterialIcons name="add-circle" size={20} color="#ffffff" />
                <Text style={styles.primaryActionBtnText}>إضافة باقة / قسم مخصص</Text>
              </Pressable>
            </View>

            {/* شبكة الباقات */}
            {adminNetworksLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#a855f7" />
              </View>
            ) : (
              <View style={styles.resellersGrid}>
                {(adminNetworks.length > 0 ? adminNetworks : DEFAULT_NETWORKS).map((net) => (
                  <View
                    key={net.id}
                    style={[
                      styles.resellerCard,
                      net.isCustom && { borderColor: '#a855f7' },
                      net.isHidden && { opacity: 0.7, borderColor: '#f59e0b' },
                    ]}
                  >
                    <View style={styles.resellerCardHeader}>
                      <View style={styles.resellerInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <MaterialIcons
                            name={(net.icon as any) || 'tv'}
                            size={22}
                            color={net.isCustom ? '#c084fc' : '#38bdf8'}
                          />
                          <Text style={styles.resellerName}>{net.name}</Text>
                        </View>
                        <Text style={styles.resellerUsername}>{net.description}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {net.isHidden ? (
                          <View style={[styles.statusBadge, { backgroundColor: '#f59e0b20' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>مخفية</Text>
                          </View>
                        ) : null}
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: net.isCustom ? '#a855f720' : '#38bdf820' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: net.isCustom ? '#c084fc' : '#38bdf8' },
                            ]}
                          >
                            {net.isCustom ? 'باقة مخصصة' : 'نظامية'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View
                      style={{
                        marginVertical: 8,
                        padding: 10,
                        backgroundColor: '#070b14',
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: '#94a3b8',
                          fontSize: 13,
                          marginBottom: 4,
                        }}
                      >
                        الكلمات المفتاحية للمطابقة:
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {net.keywords.map((kw, i) => (
                          <View
                            key={i}
                            style={{
                              backgroundColor: '#1e293b',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ color: '#e2e8f0', fontSize: 12 }}>{kw}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <View style={[styles.resellerCardActions, { flexWrap: 'wrap', gap: 8 }]}>
                      {/* زر عرض القنوات التابعة */}
                      <Pressable
                        style={[
                          styles.resellerActionBtn,
                          { backgroundColor: '#06b6d420', borderColor: '#06b6d4' },
                        ]}
                        onPress={() => handleOpenNetworkChannels(net)}
                      >
                        <MaterialIcons name="format-list-bulleted" size={16} color="#06b6d4" />
                        <Text style={[styles.resellerActionBtnText, { color: '#06b6d4', fontWeight: '700' }]}>
                          عرض القنوات
                        </Text>
                      </Pressable>

                      {/* زر تعديل الباقة */}
                      <Pressable
                        style={[
                          styles.resellerActionBtn,
                          { backgroundColor: '#a855f720', borderColor: '#a855f7' },
                        ]}
                        onPress={() => {
                          setEditingNetwork({
                            id: net.id,
                            name: net.name,
                            keywords: net.keywords.join(', '),
                            description: net.description || '',
                            icon: net.icon || 'hub',
                            sortOrder: net.sortOrder !== undefined && net.sortOrder !== null ? String(net.sortOrder) : '',
                            isCustom: Boolean(net.isCustom),
                          });
                          setShowEditNetworkModal(true);
                        }}
                      >
                        <MaterialIcons name="edit" size={16} color="#c084fc" />
                        <Text style={[styles.resellerActionBtnText, { color: '#c084fc' }]}>تعديل</Text>
                      </Pressable>

                      {/* زر إخفاء / إظهار */}
                      <Pressable
                        style={[
                          styles.resellerActionBtnSecondary,
                          { borderColor: net.isHidden ? '#10b981' : '#f59e0b' },
                        ]}
                        onPress={() => handleToggleNetworkHidden(net)}
                      >
                        <MaterialIcons
                          name={net.isHidden ? 'visibility' : 'visibility-off'}
                          size={16}
                          color={net.isHidden ? '#10b981' : '#f59e0b'}
                        />
                        <Text
                          style={[
                            styles.resellerActionBtnSecondaryText,
                            { color: net.isHidden ? '#10b981' : '#f59e0b' },
                          ]}
                        >
                          {net.isHidden ? 'إظهار' : 'إخفاء'}
                        </Text>
                      </Pressable>

                      {/* زر حذف */}
                      <Pressable
                        style={[
                          styles.resellerActionBtnSecondary,
                          { borderColor: '#ef4444' },
                        ]}
                        onPress={() => handleDeleteNetwork(net)}
                      >
                        <MaterialIcons name="delete" size={16} color="#ef4444" />
                        <Text
                          style={[
                            styles.resellerActionBtnSecondaryText,
                            { color: '#ef4444' },
                          ]}
                        >
                          حذف
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* ==========================================
             تبويب إدارة وتخصيص القنوات (Channels Overrides)
             ========================================== */
          <View style={styles.channelsTabContainer}>
            {/* الشريط العلوي الخاص بإدارة القنوات */}
            <View style={styles.resellersHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>تخصيص القنوات المختارة</Text>
                <Text style={styles.sectionSub}>
                  تعديل مسارات البث (YouTube / HLS / Iframe) أو إخفاء وترتيب القنوات المختارة فقط، مع إبقاء باقي القنوات الأصلية دون أي مساس.
                </Text>
              </View>

              <View style={styles.channelsHeaderActions}>
                <Pressable
                  style={styles.pickChannelBtn}
                  onPress={handleOpenPickChannelModal}
                >
                  <MaterialIcons name="search" size={18} color="#ffffff" />
                  <Text style={styles.pickChannelBtnText}>+ اختيار قناة لتعديلها</Text>
                </Pressable>

                <Pressable
                  style={styles.addCustomChannelBtn}
                  onPress={handleOpenAddCustomChannel}
                >
                  <MaterialIcons name="add-circle" size={18} color="#ffffff" />
                  <Text style={styles.addCustomChannelBtnText}>+ إضافة قناة جديدة</Text>
                </Pressable>
              </View>
            </View>

            {/* شريط البحث في القنوات المخصصة وإحصائيات سريعة */}
            <View style={styles.channelSearchFilterRow}>
              <View style={styles.channelSearchInputBox}>
                <MaterialIcons name="filter-list" size={18} color="#64748b" />
                <TextInput
                  style={styles.channelSearchInput}
                  value={overrideFilterQuery}
                  onChangeText={setOverrideFilterQuery}
                  placeholder="تصفية القنوات المخصصة بالاسم أو التصنيف أو المعرّف..."
                  placeholderTextColor="#64748b"
                />
                {overrideFilterQuery.length > 0 && (
                  <Pressable onPress={() => setOverrideFilterQuery('')}>
                    <MaterialIcons name="close" size={16} color="#94a3b8" />
                  </Pressable>
                )}
              </View>

              <View style={styles.channelCountsBadge}>
                <Text style={styles.channelCountsText}>
                  القنوات المخصصة: {channelOverrides.length}
                </Text>
              </View>
            </View>

            {/* قائمة القنوات المخصصة */}
            {channelOverridesLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.loadingText}>جاري تحميل قائمة القنوات المخصصة...</Text>
              </View>
            ) : filteredOverridesList.length === 0 ? (
              <View style={styles.channelsEmptyState}>
                <View style={styles.channelsEmptyIconBox}>
                  <MaterialIcons name="live-tv" size={44} color="#38bdf8" />
                </View>
                <Text style={styles.channelsEmptyTitle}>
                  {channelOverrides.length === 0
                    ? 'لم يتم تخصيص أي قناة بعد'
                    : 'لا توجد قنوات تطابق البحث'}
                </Text>
                <Text style={styles.channelsEmptyDesc}>
                  {channelOverrides.length === 0
                    ? 'جميع القنوات الأصلية تعمل بإعداداتها الافتراضية. يمكنك اختيار أي قناة تريد تعديل مسارها (لربطها بيوتيوب أو بث خارجي) أو إضافة قناة جديدة من الأزرار أعلاه.'
                    : 'جرّب كتابة اسم قناة آخر أو امسح حقل التصفية.'}
                </Text>
                {channelOverrides.length === 0 && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                    <Pressable
                      style={styles.pickChannelBtn}
                      onPress={handleOpenPickChannelModal}
                    >
                      <MaterialIcons name="search" size={18} color="#ffffff" />
                      <Text style={styles.pickChannelBtnText}>اختيار قناة من القائمة</Text>
                    </Pressable>
                    <Pressable
                      style={styles.addCustomChannelBtn}
                      onPress={handleOpenAddCustomChannel}
                    >
                      <MaterialIcons name="add" size={18} color="#ffffff" />
                      <Text style={styles.addCustomChannelBtnText}>إضافة قناة يدوياً</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.channelsGrid}>
                {filteredOverridesList.map((item, index) => {
                  const streamTypeBadgeColor =
                    item.streamType === 'youtube'
                      ? '#ef4444'
                      : item.streamType === 'iframe'
                      ? '#a855f7'
                      : item.streamType === 'hls'
                      ? '#38bdf8'
                      : '#10b981';

                  const streamTypeLabel =
                    item.streamType === 'youtube'
                      ? 'YouTube'
                      : item.streamType === 'iframe'
                      ? 'Iframe'
                      : item.streamType === 'hls'
                      ? 'HLS'
                      : 'تلقائي';

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.channelOverrideCard,
                        item.isDeleted && styles.channelCardDeleted,
                        item.isHidden && !item.isDeleted && styles.channelCardHidden,
                      ]}
                    >
                      {/* رأس بطاقة القناة */}
                      <View style={styles.channelCardHeader}>
                        <View style={styles.channelLogoWrapper}>
                          <ChannelLogo uri={item.logo} name={item.name} size={36} />
                        </View>

                        <View style={styles.channelInfoText}>
                          <View style={styles.channelNameRow}>
                            <Text style={styles.channelName} numberOfLines={1}>
                              {item.name || item.id}
                            </Text>
                            {item.isCustom ? (
                              <View style={[styles.badgePill, { backgroundColor: '#10b98125' }]}>
                                <Text style={[styles.badgePillText, { color: '#10b981' }]}>يدوية</Text>
                              </View>
                            ) : (
                              <View style={[styles.badgePill, { backgroundColor: '#38bdf825' }]}>
                                <Text style={[styles.badgePillText, { color: '#38bdf8' }]}>مخصصة</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.channelMetaRow}>
                            <Text style={styles.channelCategoryText}>
                              {item.category || 'عام'}
                            </Text>
                            <Text style={styles.channelIdText} numberOfLines={1}>
                              ID: {item.id}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.channelBadgesRight}>
                          <View
                            style={[
                              styles.streamTypeBadge,
                              { backgroundColor: `${streamTypeBadgeColor}20`, borderColor: `${streamTypeBadgeColor}50` },
                            ]}
                          >
                            <Text style={[styles.streamTypeBadgeText, { color: streamTypeBadgeColor }]}>
                              {streamTypeLabel}
                            </Text>
                          </View>

                          {item.isHidden && (
                            <View style={styles.hiddenBadge}>
                              <MaterialIcons name="visibility-off" size={12} color="#f59e0b" />
                              <Text style={styles.hiddenBadgeText}>مخفية</Text>
                            </View>
                          )}

                          {item.isDeleted && (
                            <View style={styles.deletedBadge}>
                              <MaterialIcons name="delete" size={12} color="#ef4444" />
                              <Text style={styles.deletedBadgeText}>محذوفة</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* مسار البث */}
                      <View style={styles.channelStreamUrlBox}>
                        <MaterialIcons name="link" size={14} color="#64748b" />
                        <Text style={styles.channelStreamUrlText} numberOfLines={1}>
                          {item.streamUrl || '—'}
                        </Text>
                      </View>

                      {/* شريط الإجراءات والترتيب */}
                      <View style={styles.channelCardActionsRow}>
                        <View style={styles.reorderBtnsRow}>
                          <Pressable
                            style={[styles.reorderBtn, index === 0 && { opacity: 0.3 }]}
                            onPress={() => handleMoveChannelPriority(index, 'up')}
                            disabled={index === 0}
                          >
                            <MaterialIcons name="arrow-upward" size={16} color="#94a3b8" />
                          </Pressable>
                          <Pressable
                            style={[
                              styles.reorderBtn,
                              index === filteredOverridesList.length - 1 && { opacity: 0.3 },
                            ]}
                            onPress={() => handleMoveChannelPriority(index, 'down')}
                            disabled={index === filteredOverridesList.length - 1}
                          >
                            <MaterialIcons name="arrow-downward" size={16} color="#94a3b8" />
                          </Pressable>
                          {item.sortOrder !== null && item.sortOrder !== undefined && (
                            <Text style={styles.sortOrderVal}>#{item.sortOrder}</Text>
                          )}
                        </View>

                        <View style={styles.actionBtnsGroup}>
                          <Pressable
                            style={styles.channelActionBtn}
                            onPress={() => {
                              setEditingChannel({
                                id: item.id,
                                isCustom: item.isCustom,
                                name: item.name || '',
                                logo: item.logo || '',
                                category: item.category || '',
                                streamUrl: item.streamUrl || '',
                                streamType: item.streamType,
                                isHidden: item.isHidden,
                                isDeleted: item.isDeleted,
                                sortOrder: item.sortOrder !== null && item.sortOrder !== undefined ? String(item.sortOrder) : '',
                              });
                              setShowEditChannelModal(true);
                            }}
                          >
                            <MaterialIcons name="edit" size={16} color="#38bdf8" />
                            <Text style={[styles.channelActionBtnText, { color: '#38bdf8' }]}>تعديل</Text>
                          </Pressable>

                          <Pressable
                            style={styles.channelActionBtn}
                            onPress={() => handleToggleChannelHidden(item)}
                          >
                            <MaterialIcons
                              name={item.isHidden ? 'visibility' : 'visibility-off'}
                              size={16}
                              color={item.isHidden ? '#10b981' : '#f59e0b'}
                            />
                            <Text
                              style={[
                                styles.channelActionBtnText,
                                { color: item.isHidden ? '#10b981' : '#f59e0b' },
                              ]}
                            >
                              {item.isHidden ? 'إظهار' : 'إخفاء'}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.channelActionBtn}
                            onPress={() => handleToggleChannelDeleted(item)}
                          >
                            <MaterialIcons
                              name={item.isDeleted ? 'restore' : 'delete'}
                              size={16}
                              color={item.isDeleted ? '#10b981' : '#ef4444'}
                            />
                            <Text
                              style={[
                                styles.channelActionBtnText,
                                { color: item.isDeleted ? '#10b981' : '#ef4444' },
                              ]}
                            >
                              {item.isDeleted ? 'استعادة' : 'حذف'}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[styles.channelActionBtn, { borderColor: 'rgba(255,255,255,0.08)' }]}
                            onPress={() => handleDeleteChannelOverride(item.id, item.isCustom)}
                          >
                            <MaterialIcons name="replay" size={16} color="#94a3b8" />
                            <Text style={[styles.channelActionBtnText, { color: '#94a3b8' }]}>
                              {item.isCustom ? 'حذف كلي' : 'استعادة الأصل'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ==========================================
          مودال إضافة موزع جديد
          ========================================== */}
      <Modal visible={showAddResellerModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="person-add" size={24} color="#f59e0b" />
                <Text style={styles.modalTitle}>إضافة موزع جديد</Text>
              </View>
              <Pressable onPress={() => setShowAddResellerModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم الموزع / المحل:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerName}
                  onChangeText={setNewResellerName}
                  placeholder="مثال: موزع الرياض الرقمي"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم المستخدم لتسجيل الدخول:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerUsername}
                  onChangeText={setNewResellerUsername}
                  placeholder="مثال: riyadh_dealer"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>البريد الإلكتروني (اختياري):</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerEmail}
                  onChangeText={setNewResellerEmail}
                  placeholder="dealer@domain.com"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>كلمة المرور (6 أحرف فأكثر):</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerPassword}
                  onChangeText={setNewResellerPassword}
                  placeholder="كلمة مرور الدخول لبوابة الموزع"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>ملاحظات إضافية عن الموزع:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerNote}
                  onChangeText={setNewResellerNote}
                  placeholder="مثال: موزع معتمد في منطقة الرياض، هاتف: 05xxxx"
                  placeholderTextColor="#64748b"
                />
              </View>

              {newResellerModalError && (
                <View style={styles.modalErrorBox}>
                  <MaterialIcons name="error" size={16} color="#ef4444" />
                  <Text style={styles.modalErrorText}>{newResellerModalError}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowAddResellerModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={styles.modalConfirmBtn}
                onPress={handleCreateResellerSubmit}
                disabled={actionLoading === 'create_reseller'}
              >
                {actionLoading === 'create_reseller' ? (
                  <ActivityIndicator color="#070b14" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>إنشاء الموزع</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          مودال تعديل بيانات موزع
          ========================================== */}
      <Modal visible={showEditResellerModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="edit" size={24} color="#38bdf8" />
                <Text style={styles.modalTitle}>تعديل بيانات الموزع</Text>
              </View>
              <Pressable onPress={() => setShowEditResellerModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم الموزع:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerName}
                  onChangeText={setEditResellerName}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم المستخدم:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerUsername}
                  onChangeText={setEditResellerUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>البريد الإلكتروني:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerEmail}
                  onChangeText={setEditResellerEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية):</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerPassword}
                  onChangeText={setEditResellerPassword}
                  placeholder="أدخل كلمة مرور جديدة للتغيير"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>حالة الحساب:</Text>
                <View style={styles.pillsRow}>
                  <Pressable
                    style={[
                      styles.selectorPill,
                      editResellerStatus === 'active' && styles.selectorPillActive,
                    ]}
                    onPress={() => setEditResellerStatus('active')}
                  >
                    <Text
                      style={[
                        styles.selectorPillText,
                        editResellerStatus === 'active' && styles.selectorPillTextActive,
                      ]}
                    >
                      حساب نشط
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.selectorPill,
                      editResellerStatus === 'suspended' && [
                        styles.selectorPillActive,
                        { borderColor: '#ef4444', backgroundColor: '#450a0a' },
                      ],
                    ]}
                    onPress={() => setEditResellerStatus('suspended')}
                  >
                    <Text
                      style={[
                        styles.selectorPillText,
                        editResellerStatus === 'suspended' && { color: '#f87171' },
                      ]}
                    >
                      حساب موقوف
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>الملاحظات:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerNote}
                  onChangeText={setEditResellerNote}
                />
              </View>

              {editResellerModalError && (
                <View style={styles.modalErrorBox}>
                  <MaterialIcons name="error" size={16} color="#ef4444" />
                  <Text style={styles.modalErrorText}>{editResellerModalError}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowEditResellerModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={styles.modalConfirmBtn}
                onPress={handleEditResellerSubmit}
                disabled={actionLoading === 'edit_reseller'}
              >
                {actionLoading === 'edit_reseller' ? (
                  <ActivityIndicator color="#070b14" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>حفظ التعديلات</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          مودال إضافة باقة أو قسم مخصص
          ========================================== */}
      <Modal visible={showAddNetworkModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="hub" size={24} color="#a855f7" />
                <Text style={styles.modalTitle}>إضافة باقة أو قسم مخصص</Text>
              </View>
              <Pressable onPress={() => setShowAddNetworkModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم الباقة (مثال: قنوات SSC الرياضية أو باقة شاهد):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="اسم الباقة..."
                  placeholderTextColor="#64748b"
                  value={newNetworkName}
                  onChangeText={setNewNetworkName}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>
                  الكلمات المفتاحية للمطابقة في اسم القناة (افصل بينها بفاصلة):
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="مثال: ssc, ssc 1, الرياضة السعودية"
                  placeholderTextColor="#64748b"
                  value={newNetworkKeywords}
                  onChangeText={setNewNetworkKeywords}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>الوصف (اختياري):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="وصف مختصر للباقة..."
                  placeholderTextColor="#64748b"
                  value={newNetworkDesc}
                  onChangeText={setNewNetworkDesc}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowAddNetworkModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={[styles.modalConfirmBtn, { backgroundColor: '#a855f7' }]}
                onPress={handleCreateCustomNetwork}
              >
                <Text style={styles.modalConfirmBtnText}>حفظ وإضافة الباقة</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          مودال اختيار قناة من البث لتعديلها
          ========================================== */}
      <Modal visible={showPickChannelModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 640, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="search" size={24} color="#38bdf8" />
                <Text style={styles.modalTitle}>اختيار قناة من البث لتعديلها</Text>
              </View>
              <Pressable onPress={() => setShowPickChannelModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <View style={styles.searchBox}>
                <MaterialIcons name="search" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="ابحث باسم القناة أو التصنيف (مثال: beIN, الجزيرة, MBC)..."
                  placeholderTextColor="#64748b"
                  value={channelSearchQuery}
                  onChangeText={setChannelSearchQuery}
                />
                {channelSearchQuery ? (
                  <Pressable onPress={() => setChannelSearchQuery('')}>
                    <MaterialIcons name="clear" size={18} color="#94a3b8" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {allChannelsLoading ? (
              <View style={[styles.loadingBox, { padding: 40 }]}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>جاري تحميل قائمة القنوات من البث...</Text>
              </View>
            ) : (
              <ScrollView style={[styles.modalBody, { maxHeight: 420 }]}>
                {filteredSearchChannels.length === 0 ? (
                  <View style={[styles.emptyBox, { padding: 30 }]}>
                    <MaterialIcons name="search-off" size={40} color="#475569" />
                    <Text style={styles.emptyText}>لم يتم العثور على قنوات مطابقة لبحثك</Text>
                  </View>
                ) : (
                  filteredSearchChannels.map((item) => (
                    <View key={item.id} style={styles.pickChannelItemRow}>
                      <View style={styles.pickChannelLogoBox}>
                        <ChannelLogo uri={item.logo} name={item.name} size={36} />
                      </View>
                      <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <Text style={styles.pickChannelItemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.pickChannelItemCat} numberOfLines={1}>
                          {item.groupTitle || 'عام'}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.pickChannelActionBtn}
                        onPress={() => handleSelectChannelToOverride(item)}
                      >
                        <MaterialIcons name="edit" size={16} color="#ffffff" />
                        <Text style={styles.pickChannelActionBtnText}>تعديل القناة</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowPickChannelModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إغلاق</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          مودال تعديل تخصيص أو إضافة قناة مخصصة
          ========================================== */}
      <Modal visible={showEditChannelModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 640, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons
                  name={editingChannel.isCustom ? 'add-to-photos' : 'edit-note'}
                  size={24}
                  color={editingChannel.isCustom ? '#10b981' : '#38bdf8'}
                />
                <Text style={styles.modalTitle}>
                  {editingChannel.isCustom ? 'إضافة قناة جديدة مخصصة' : 'تخصيص القناة المحددة'}
                </Text>
              </View>
              <Pressable onPress={() => setShowEditChannelModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* اسم القناة */}
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم القناة: *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="مثال: beIN SPORTS 1 HD"
                  placeholderTextColor="#64748b"
                  value={editingChannel.name}
                  onChangeText={(val) => setEditingChannel((p) => ({ ...p, name: val }))}
                />
              </View>

              {/* رابط الشعار */}
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>رابط الشعار (اختياري):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="https://example.com/logo.png"
                  placeholderTextColor="#64748b"
                  value={editingChannel.logo}
                  onChangeText={(val) => setEditingChannel((p) => ({ ...p, logo: val }))}
                />
              </View>

              {/* التصنيف / الباقة */}
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>التصنيف / الباقة:</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="مثال: قنوات رياضية"
                  placeholderTextColor="#64748b"
                  value={editingChannel.category}
                  onChangeText={(val) => setEditingChannel((p) => ({ ...p, category: val }))}
                />
              </View>

              {/* رابط البث */}
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>رابط البث (Stream URL / YouTube / Web): *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="https://.../stream.m3u8 أو رابط يوتيوب أو صفحة ويب"
                  placeholderTextColor="#64748b"
                  value={editingChannel.streamUrl}
                  onChangeText={(val) => setEditingChannel((p) => ({ ...p, streamUrl: val }))}
                />
              </View>

              {/* نوع المشغل */}
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>نوع المشغل (Stream Type):</Text>
                <View style={styles.streamTypeSelectorRow}>
                  {[
                    { key: 'auto', label: 'تلقائي (Auto)' },
                    { key: 'hls', label: 'HLS (.m3u8)' },
                    { key: 'youtube', label: 'YouTube Live' },
                    { key: 'iframe', label: 'موقع ويب (Iframe)' },
                  ].map((st) => (
                    <Pressable
                      key={st.key}
                      style={[
                        styles.streamTypeOption,
                        editingChannel.streamType === st.key && styles.streamTypeOptionActive,
                      ]}
                      onPress={() => setEditingChannel((p) => ({ ...p, streamType: st.key as any }))}
                    >
                      <Text
                        style={[
                          styles.streamTypeOptionText,
                          editingChannel.streamType === st.key && styles.streamTypeOptionTextActive,
                        ]}
                      >
                        {st.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* ترتيب الظهور */}
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>ترتيب الأولوية (أرقام أصغر تظهر أولاً، اختياري):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="مثال: 1 أو 10 (اتركه فارغاً للترتيب الافتراضي)"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  value={editingChannel.sortOrder}
                  onChangeText={(val) => setEditingChannel((p) => ({ ...p, sortOrder: val }))}
                />
              </View>

              {/* خيارات الحالة: إخفاء / حذف */}
              <View style={styles.toggleRowContainer}>
                <Pressable
                  style={[styles.toggleOptionBox, editingChannel.isHidden && { borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}
                  onPress={() => setEditingChannel((p) => ({ ...p, isHidden: !p.isHidden }))}
                >
                  <MaterialIcons
                    name={editingChannel.isHidden ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={editingChannel.isHidden ? '#f59e0b' : '#94a3b8'}
                  />
                  <Text style={[styles.toggleOptionText, editingChannel.isHidden && { color: '#f59e0b' }]}>
                    {editingChannel.isHidden ? 'القناة مخفية' : 'القناة ظاهرة'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.toggleOptionBox, editingChannel.isDeleted && { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                  onPress={() => setEditingChannel((p) => ({ ...p, isDeleted: !p.isDeleted }))}
                >
                  <MaterialIcons
                    name={editingChannel.isDeleted ? 'delete' : 'delete-outline'}
                    size={20}
                    color={editingChannel.isDeleted ? '#ef4444' : '#94a3b8'}
                  />
                  <Text style={[styles.toggleOptionText, editingChannel.isDeleted && { color: '#ef4444' }]}>
                    {editingChannel.isDeleted ? 'محذوفة من العرض' : 'غير محذوفة'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowEditChannelModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={[styles.modalConfirmBtn, { backgroundColor: editingChannel.isCustom ? '#10b981' : '#38bdf8' }]}
                onPress={handleSaveChannelOverride}
                disabled={channelOverridesSaving}
              >
                {channelOverridesSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>
                    {editingChannel.isCustom ? 'حفظ وإضافة القناة' : 'تطبيق وحفظ التخصيص'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          مودال عرض وتخصيص قنوات الباقة (Network Channels Modal)
          ========================================== */}
      <Modal visible={showNetworkChannelsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 760, maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="hub" size={24} color="#06b6d4" />
                <View>
                  <Text style={styles.modalTitle}>
                    القنوات التابعة لـ {selectedNetworkForChannels?.name}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                    تعديل مسارات البث أو إخفاء وحذف قنوات هذه الباقة مباشرة
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setShowNetworkChannelsModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {allChannelsLoading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#06b6d4" />
                  <Text style={{ color: '#94a3b8', marginTop: 12 }}>جارٍ تحميل قنوات البث...</Text>
                </View>
              ) : (() => {
                if (!selectedNetworkForChannels) return null;
                const matched = allM3uChannels.filter((ch) =>
                  matchChannelToNetwork(ch, selectedNetworkForChannels)
                );

                if (matched.length === 0) {
                  return (
                    <View style={{ padding: 30, alignItems: 'center' }}>
                      <MaterialIcons name="tv-off" size={42} color="#475569" />
                      <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
                        لا توجد قنوات تطابق الكلمات المفتاحية لهذه الباقة حالياً
                      </Text>
                    </View>
                  );
                }

                return (
                  <View style={{ gap: 10 }}>
                    <Text style={{ color: '#06b6d4', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
                      إجمالي القنوات المطابقة: {matched.length} قناة
                    </Text>
                    {matched.map((ch) => {
                      const override = channelOverrides.find(
                        (o) => o.id.toLowerCase() === ch.id.toLowerCase()
                      );
                      const isHidden = override?.isHidden ?? false;
                      const isDeleted = override?.isDeleted ?? false;

                      return (
                        <View
                          key={ch.id}
                          style={[
                            styles.channelCard,
                            { padding: 12 },
                            isHidden && { opacity: 0.6, borderColor: '#f59e0b' },
                            isDeleted && { opacity: 0.4, borderColor: '#ef4444' },
                          ]}
                        >
                          <View style={styles.channelCardHeader}>
                            <View style={styles.channelLogoBox}>
                              <ChannelLogo uri={ch.logo} name={ch.name} size={32} />
                            </View>

                            <View style={styles.channelInfoText}>
                              <View style={styles.channelNameRow}>
                                <Text style={styles.channelName} numberOfLines={1}>
                                  {override?.name || ch.name}
                                </Text>
                                {override && (
                                  <View style={[styles.badgePill, { backgroundColor: '#38bdf825' }]}>
                                    <Text style={[styles.badgePillText, { color: '#38bdf8' }]}>مخصصة</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.channelCategoryText}>
                                {override?.category || ch.groupTitle || 'عام'} • ID: {ch.id}
                              </Text>
                            </View>

                            <View style={styles.channelBadgesRight}>
                              {isHidden && (
                                <View style={styles.hiddenBadge}>
                                  <MaterialIcons name="visibility-off" size={12} color="#f59e0b" />
                                  <Text style={styles.hiddenBadgeText}>مخفية</Text>
                                </View>
                              )}
                              {isDeleted && (
                                <View style={styles.deletedBadge}>
                                  <MaterialIcons name="delete" size={12} color="#ef4444" />
                                  <Text style={styles.deletedBadgeText}>محذوفة</Text>
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={styles.channelStreamUrlBox}>
                            <MaterialIcons name="link" size={14} color="#64748b" />
                            <Text style={styles.channelStreamUrlText} numberOfLines={1}>
                              {override?.streamUrl || ch.url || '—'}
                            </Text>
                          </View>

                          <View style={[styles.channelCardActionsRow, { justifyContent: 'flex-end', marginTop: 8 }]}>
                            <View style={styles.actionBtnsGroup}>
                              <Pressable
                                style={styles.channelActionBtn}
                                onPress={() => {
                                  setShowNetworkChannelsModal(false);
                                  handleSelectChannelToOverride(ch);
                                }}
                              >
                                <MaterialIcons name="edit" size={14} color="#38bdf8" />
                                <Text style={styles.channelActionBtnText}>تعديل البث والاسم</Text>
                              </Pressable>

                              <Pressable
                                style={[styles.channelActionBtn, isHidden && styles.channelActionBtnActive]}
                                onPress={() => {
                                  if (override) {
                                    handleToggleChannelHidden(override);
                                  } else {
                                    handleSelectChannelToOverride(ch);
                                  }
                                }}
                              >
                                <MaterialIcons
                                  name={isHidden ? 'visibility' : 'visibility-off'}
                                  size={14}
                                  color={isHidden ? '#10b981' : '#f59e0b'}
                                />
                                <Text style={[styles.channelActionBtnText, isHidden && { color: '#10b981' }]}>
                                  {isHidden ? 'إظهار' : 'إخفاء'}
                                </Text>
                              </Pressable>

                              <Pressable
                                style={[styles.channelActionBtn, isDeleted && styles.channelActionBtnDangerActive]}
                                onPress={() => {
                                  if (override) {
                                    handleToggleChannelDeleted(override);
                                  } else {
                                    handleSelectChannelToOverride(ch);
                                  }
                                }}
                              >
                                <MaterialIcons
                                  name={isDeleted ? 'restore' : 'delete'}
                                  size={14}
                                  color={isDeleted ? '#10b981' : '#ef4444'}
                                />
                                <Text style={[styles.channelActionBtnText, { color: isDeleted ? '#10b981' : '#ef4444' }]}>
                                  {isDeleted ? 'استعادة' : 'حذف'}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowNetworkChannelsModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إغلاق</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          مودال تعديل الباقة / السلسلة (Edit Network Modal)
          ========================================== */}
      <Modal visible={showEditNetworkModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="edit" size={24} color="#a855f7" />
                <Text style={styles.modalTitle}>
                  تعديل باقة {editingNetwork?.name}
                </Text>
              </View>
              <Pressable onPress={() => setShowEditNetworkModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم الباقة: *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="اسم الباقة..."
                  placeholderTextColor="#64748b"
                  value={editingNetwork?.name || ''}
                  onChangeText={(val) =>
                    setEditingNetwork((p) => (p ? { ...p, name: val } : null))
                  }
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>
                  الكلمات المفتاحية للمطابقة (افصل بينها بفاصلة): *
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="مثال: mbc, ام بي سي, شاهد"
                  placeholderTextColor="#64748b"
                  value={editingNetwork?.keywords || ''}
                  onChangeText={(val) =>
                    setEditingNetwork((p) => (p ? { ...p, keywords: val } : null))
                  }
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>الوصف:</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="وصف الباقة..."
                  placeholderTextColor="#64748b"
                  value={editingNetwork?.description || ''}
                  onChangeText={(val) =>
                    setEditingNetwork((p) => (p ? { ...p, description: val } : null))
                  }
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>الأيقونة (MaterialIcon Name):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="tv / movie / sports / live-tv..."
                  placeholderTextColor="#64748b"
                  value={editingNetwork?.icon || ''}
                  onChangeText={(val) =>
                    setEditingNetwork((p) => (p ? { ...p, icon: val } : null))
                  }
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>ترتيب الظهور (sortOrder):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="مثال: 10 أو 20"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  value={editingNetwork?.sortOrder || ''}
                  onChangeText={(val) =>
                    setEditingNetwork((p) => (p ? { ...p, sortOrder: val } : null))
                  }
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowEditNetworkModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={[styles.modalConfirmBtn, { backgroundColor: '#a855f7' }]}
                onPress={handleSaveEditedNetwork}
                disabled={savingNetwork}
              >
                {savingNetwork ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>حفظ التعديلات</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          مودال معاينة مشغلات VOD (VidLink / VidSrc / YouTube / Archive)
          ========================================== */}
      <Modal visible={vodPreviewModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 840, maxHeight: '90%', height: 560 }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="play-circle-filled" size={24} color="#06b6d4" />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {vodPreviewTitle || 'معاينة المشغل'}
                </Text>
              </View>
              <Pressable onPress={() => setVodPreviewModalVisible(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={{ flex: 1, backgroundColor: '#000000', borderRadius: 8, overflow: 'hidden' }}>
              {Platform.OS === 'web' ? (
                // @ts-ignore
                <iframe
                  src={vodPreviewUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                  <Text style={{ color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>
                    معاينة المشغل متاحة عبر الرابط المباشر على منصات Native:
                  </Text>
                  <Text style={{ color: '#38bdf8', fontSize: 12, textAlign: 'center' }}>
                    {vodPreviewUrl}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setVodPreviewModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>إغلاق المعاينة</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 64,
  },

  // تسجيل الدخول
  loginContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#131C31',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
    alignItems: 'center',
  },
  loginIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSub: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  loginInputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 50,
  },
  loginInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 10,
    textAlign: 'right',
  },
  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  loginButtonText: {
    color: '#070b14',
    fontSize: 16,
    fontWeight: '700',
  },
  backToHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  backToHomeText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  errorBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },

  // الشريط العلوي
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitleRow: {
    alignItems: 'flex-start',
    gap: 4,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerBadgeText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
  headerMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },

  // تبويبات التنقل
  mainNavTabs: {
    flexDirection: 'row',
    backgroundColor: '#0b1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 24,
    gap: 12,
  },
  mainNavTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  mainNavTabActive: {
    borderBottomColor: '#38bdf8',
  },
  mainNavTabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94a3b8',
  },
  mainNavTabTextActive: {
    color: '#ffffff',
  },

  // شريط الحالة
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.25)',
  },
  statusBarText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  // شبكة الإحصائيات
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    textAlign: 'right',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'right',
  },

  // قسم النموذج
  cardSection: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  formGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  formGridCol: {
    flexDirection: 'column',
    gap: 14,
  },
  formGroup: {
    flex: 1,
    minWidth: 260,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
    textAlign: 'right',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ownerAutoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  ownerAutoBadgeText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  autoTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  autoTagText: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '600',
  },
  selectorPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectorPillSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectorPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  selectorPillText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  selectorPillTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 44,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'right',
  },
  generateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    height: 48,
    marginTop: 8,
  },
  generateButtonText: {
    color: '#070b14',
    fontSize: 15,
    fontWeight: '800',
  },

  // دفعة الأكواد
  batchContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  batchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 10,
    textAlign: 'right',
  },
  batchList: {
    gap: 8,
  },
  batchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
  },
  batchCodeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1.5,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  copyPillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  copyPillText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  copyPillTextSuccess: {
    color: '#10b981',
  },

  // الفلاتر
  filterSection: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
    gap: 12,
  },
  resellerFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterHeaderLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
  },
  resellerPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  resellerPillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
  },
  resellerPillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  resellerPillTextActive: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingHorizontal: 8,
    textAlign: 'right',
  },
  statusTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  statusTabPillActive: {
    backgroundColor: '#38bdf8',
  },
  statusTabPillText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  statusTabPillTextActive: {
    color: '#070b14',
    fontWeight: '800',
  },

  // شبكة الأكواد
  codesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  codeCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  codeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  codeMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  codeValueText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  copyIconBtnSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  codeDetails: {
    gap: 6,
    marginBottom: 14,
    direction: 'rtl',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    direction: 'rtl',
    justifyContent: 'flex-start',
  },
  detailLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailVal: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  remainingVal: {
    fontSize: 12,
    color: '#34d399',
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  codeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 12,
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionBtnSmallText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },

  // تبويب الموزعين
  resellersTabContainer: {
    gap: 20,
  },
  resellersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionHeaderSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  addResellerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addResellerBtnText: {
    color: '#070b14',
    fontSize: 14,
    fontWeight: '800',
  },
  resellersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  resellerCard: {
    flex: 1,
    minWidth: 340,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 14,
  },
  resellerCardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  resellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resellerNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  resellerStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  resellerStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  resellerUsernameText: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '600',
  },
  resellerEmailText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  resellerNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 8,
  },
  resellerNoteText: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
    textAlign: 'right',
  },
  resellerStatsBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
  },
  resellerStatItem: {
    alignItems: 'center',
  },
  resellerStatVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  resellerStatLbl: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  resellerActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  resellerActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  resellerActionBtnPrimaryText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  resellerActionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  resellerActionBtnSecondaryText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },

  // المودال
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalFieldGroup: {
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
    textAlign: 'right',
  },
  modalInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 44,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'right',
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  modalErrorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  modalCancelBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#38bdf8',
  },
  modalConfirmBtnText: {
    color: '#070b14',
    fontSize: 14,
    fontWeight: '800',
  },

  // عام
  loadingBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  emptyBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
  },

  // إعدادات وسيرفرات الأفلام والمسلسلات VOD
  vodTabContainer: {
    paddingBottom: 32,
  },
  saveVodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ec4899',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveVodBtnText: {
    color: '#070b14',
    fontSize: 14,
    fontWeight: '800',
  },
  saveVodBtnBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ec4899',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  vodCardsStack: {
    gap: 18,
    marginTop: 16,
  },
  vodCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
  },
  vodSettingsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  vodCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  vodCardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vodCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  vodCardDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
  },
  toggleSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleSwitchBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  toggleSwitchBtnInactive: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  toggleSwitchText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  policyOptionsRow: {
    gap: 12,
    marginTop: 16,
  },
  policyOptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 14,
  },
  policyOptionCardActive: {
    borderColor: '#ec4899',
    backgroundColor: 'rgba(236, 72, 153, 0.08)',
  },
  policyOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748b',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  policyOptionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ec4899',
  },
  policyOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 3,
  },
  policyOptionSub: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  serverList: {
    marginTop: 16,
    gap: 10,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    gap: 12,
  },
  serverRankBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverRankText: {
    color: '#ec4899',
    fontSize: 13,
    fontWeight: '800',
  },
  serverName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  serverIdText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  serverStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  serverStatusBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  serverStatusBtnInactive: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  serverStatusBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  reorderBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reorderBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  channelsTabContainer: {
    gap: 20,
  },
  channelsHeaderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  pickChannelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pickChannelBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  addCustomChannelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addCustomChannelBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  channelSearchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  channelSearchInputBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  channelSearchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  channelCountsBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  channelCountsText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  channelsEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 40,
    marginTop: 10,
  },
  channelsEmptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  channelsEmptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  channelsEmptyDesc: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 500,
    lineHeight: 22,
  },
  channelsGrid: {
    gap: 12,
  },
  channelOverrideCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  channelCardDeleted: {
    opacity: 0.6,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.03)',
  },
  channelCardHidden: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  channelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelLogoWrapper: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  channelLogoImg: {
    width: 40,
    height: 40,
  },
  channelInfoText: {
    flex: 1,
    gap: 4,
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  channelName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  channelMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  channelCategoryText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  channelIdText: {
    color: '#64748b',
    fontSize: 11,
  },
  channelBadgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streamTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  streamTypeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  hiddenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hiddenBadgeText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  deletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deletedBadgeText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  channelStreamUrlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#070b14',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  channelStreamUrlText: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  channelCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    flexWrap: 'wrap',
    gap: 8,
  },
  reorderBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortOrderVal: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
  actionBtnsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  channelActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  channelActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pickChannelItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  pickChannelLogoBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickChannelItemName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  pickChannelItemCat: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  pickChannelActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pickChannelActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  streamTypeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  streamTypeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  streamTypeOptionActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  streamTypeOptionText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  streamTypeOptionTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  toggleRowContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  toggleOptionBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#1e293b',
  },
  toggleOptionText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },

  // أنماط البحث وتخصيص VOD العربي
  vodSearchItemCard: {
    width: 130,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  vodSearchItemCardActive: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  vodSearchPoster: {
    width: 130,
    height: 180,
    backgroundColor: '#1e293b',
  },
  vodSearchPosterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  vodSearchItemTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    minHeight: 32,
  },
  vodSearchItemYear: {
    color: '#94a3b8',
    fontSize: 11,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  smallActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  channelActionBtnDangerActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
});
