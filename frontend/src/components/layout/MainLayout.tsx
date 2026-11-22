import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../context/AuthContext';

export interface NavItem {
  id: string;
  title: string;
  route: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'channels', title: 'القنوات التلفزيونية', route: '/home', icon: 'live-tv' },
  { id: 'movies', title: 'الأفلام والمسلسلات', route: '/movies', icon: 'movie' },
  { id: 'favorites', title: 'المفضلة', route: '/favorites', icon: 'star' },
  { id: 'settings', title: 'الإعدادات', route: '/settings', icon: 'settings' },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * التخطيط الرئيسي للتطبيق (Master-Detail Layout) بتصميم تلفاز داكن احترافي.
 * يعتمد StyleSheet القياسي لضمان مظهر موحد واستجابة كاملة لريموت التلفاز.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const router = useRouter();
  const rawPath = usePathname();
  const currentPath = String(rawPath || '');
  const isChildMode = useAppStore((state) => state.isChildMode);
  const insets = useSafeAreaInsets();

  const isSidebarFocused = useAppStore((state) => state.isSidebarFocused);
  const focusedSidebarIndex = useAppStore((state) => state.focusedSidebarIndex);
  const setIsSidebarFocused = useAppStore((state) => state.setIsSidebarFocused);
  const setFocusedSidebarIndex = useAppStore((state) => state.setFocusedSidebarIndex);

  const isSidebarFocusedRef = useRef(isSidebarFocused);
  isSidebarFocusedRef.current = isSidebarFocused;
  const focusedSidebarIndexRef = useRef(focusedSidebarIndex);
  focusedSidebarIndexRef.current = focusedSidebarIndex;

  // إعادة تعيين تركيز الشريط الجانبي عند تغيير المسار
  useEffect(() => {
    setIsSidebarFocused(false);
  }, [currentPath, setIsSidebarFocused]);

  // دعم التنقل بالريموت للشريط الجانبي عند تفعيله فقط مع شبكة أمان لصفحات التطبيق الأخرى
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      // إذا لم يكن التركيز على الشريط الجانبي: لا تعترض زر Enter أو غيره أبداً، دعه يمر للصفحة النشطة!
      if (!isSidebarFocusedRef.current) {
        // شبكة أمان: في أي صفحة غير /home و /movies و /play، سهم اليمين يفعّل الشريط الجانبي
        const isExcluded =
          currentPath === '/home' ||
          currentPath === '/' ||
          currentPath.startsWith('/movies') ||
          currentPath.startsWith('/play') ||
          currentPath.startsWith('/player');

        if (!isExcluded && (e.key === 'ArrowRight' || e.key === 'Escape')) {
          e.preventDefault();
          setIsSidebarFocused(true);
          const currentIdx = NAV_ITEMS.findIndex((item) =>
            item.route === '/home' ? currentPath === '/home' : currentPath.startsWith(item.route)
          );
          setFocusedSidebarIndex(currentIdx >= 0 ? currentIdx : 0);
        }
        return;
      }

      // إذا كان التركيز على الشريط الجانبي فعلياً فقط:
      const isConfirm =
        e.key === 'Enter' ||
        e.key === 'NumpadEnter' ||
        e.key === 'Select' ||
        e.key === 'Ok' ||
        e.key === 'OK' ||
        e.keyCode === 13 ||
        e.keyCode === 23 ||
        e.which === 13 ||
        e.which === 23;

      if (isConfirm) {
        e.preventDefault();
        e.stopPropagation();
        const target = NAV_ITEMS[focusedSidebarIndexRef.current];
        if (target) {
          setIsSidebarFocused(false);
          router.push(target.route as any);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setFocusedSidebarIndex(Math.max(0, focusedSidebarIndexRef.current - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedSidebarIndex(Math.min(NAV_ITEMS.length - 1, focusedSidebarIndexRef.current + 1));
          break;
        case 'ArrowLeft':
          // سهم اليسار يرجع للمحتوى في واجهة RTL
          e.preventDefault();
          setIsSidebarFocused(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentPath,
    setIsSidebarFocused,
    setFocusedSidebarIndex,
    router,
  ]);

  return (
    <View
      style={[
        styles.rootContainer,
        {
          paddingTop: Math.max(insets.top, 0),
          paddingBottom: Math.max(insets.bottom, 0),
        },
      ]}
    >
      {/* الشريط الجانبي (Sidebar) */}
      <View style={styles.sidebar}>
        <View>
          {/* شعار المنصة تلفازي */}
          <View style={styles.brandContainer}>
            <View style={styles.logoRow}>
              <Image
                source={{ uri: '/icon.png' }}
                style={styles.brandLogoImg}
                resizeMode="contain"
              />
              <View style={styles.brandTextCol}>
                <Text style={styles.brandTitle}>تلفازي</Text>
                <Text style={styles.brandSub}>Telfazi</Text>
              </View>
            </View>

            {isChildMode && (
              <View style={styles.childModeBadge}>
                <MaterialIcons name="lock" size={12} color="#f59e0b" />
                <Text style={styles.childModeText}>وضع الطفل مفعّل</Text>
              </View>
            )}
          </View>

          {/* أزرار التنقل مع إطار تركيز مضيء للريموت */}
          <View style={styles.navContainer}>
            {NAV_ITEMS.map((item, index) => {
              const isActive =
                item.route === '/home'
                  ? currentPath === '/home' || currentPath.startsWith('/category')
                  : currentPath === item.route || (item.route !== '/' && currentPath.startsWith(item.route));
              const isItemFocused = isSidebarFocused && focusedSidebarIndex === index;

              return (
                <Pressable
                  key={item.id}
                  hasTVPreferredFocus={index === 0}
                  onPress={() => router.push(item.route as any)}
                  style={({ focused }) => [
                    styles.navItem,
                    isActive && styles.navItemActive,
                    (isItemFocused || focused) && styles.navItemFocused,
                  ]}
                >
                  {({ focused }) => {
                    const rowFocused = isItemFocused || focused;
                    const iconColor = rowFocused
                      ? '#38bdf8'
                      : isActive
                      ? item.id === 'favorites'
                        ? '#eab308'
                        : '#38bdf8'
                      : '#94a3b8';

                    return (
                      <View style={styles.navItemInner}>
                        <MaterialIcons name={item.icon} size={24} color={iconColor} />
                        <Text
                          style={[
                            styles.navItemText,
                            isActive && styles.navItemTextActive,
                            rowFocused && styles.navItemTextFocused,
                          ]}
                        >
                          {item.title}
                        </Text>
                      </View>
                    );
                  }}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* إرشادات التحكم بريموت التلفاز */}
        <View style={styles.sidebarFooter}>
          <Text style={styles.footerHelpText}>الأسهم للتنقل • OK للاختيار</Text>
        </View>
      </View>

      {/* مساحة عرض المحتوى الرئيسية (بدون حواف في /home لتعبئة الشاشة بأسلوب IPTV) */}
      <View
        style={[
          styles.contentArea,
          (currentPath === '/home' || currentPath.startsWith('/category')) && styles.contentAreaFull,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0f172a', // خلفية داكنة فخمة
    height: '100%',
    width: '100%',
    ...(Platform.OS === 'web' ? ({ direction: 'rtl' } as any) : {}),
  },
  sidebar: {
    width: 260,
    backgroundColor: '#0B1120',
    borderLeftWidth: 1,
    borderLeftColor: '#1e293b',
    padding: 24,
    justifyContent: 'space-between',
  },
  brandContainer: {
    marginBottom: 32,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogoImg: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  brandTextCol: {
    marginLeft: 10,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0EA5E9',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  childModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  childModeText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  navContainer: {
    gap: 10,
  },
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: '#131C31',
    borderColor: '#0EA5E9',
  },
  navItemFocused: {
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#38bdf8',
    transform: [{ scale: 1.04 }],
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 8,
  },
  navItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navItemText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  navItemTextActive: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  navItemTextFocused: {
    color: '#38bdf8',
    fontWeight: '800',
  },
  sidebarFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  footerHelpText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#0B1120',
    padding: 32,
  },
  contentAreaFull: {
    padding: 0,
  },
  subCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  subCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  subStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  subCardTitle: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  subDaysText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  subCodeText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    marginTop: 2,
    marginBottom: 8,
  },
  changeCodeBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  changeCodeBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  changeCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeCodeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  changeCodeTextFocused: {
    color: '#000000',
  },
});
