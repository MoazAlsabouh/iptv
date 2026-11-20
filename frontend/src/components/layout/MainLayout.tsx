import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  id: string;
  title: string;
  route: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const NAV_ITEMS: NavItem[] = [
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
  const currentPath = usePathname();
  const isChildMode = useAppStore((state) => state.isChildMode);

  return (
    <View style={styles.rootContainer}>
      {/* الشريط الجانبي (Sidebar) */}
      <View style={styles.sidebar}>
        <View>
          {/* شعار التطبيق */}
          <View style={styles.brandContainer}>
            <View style={styles.logoRow}>
              <MaterialIcons
                name="tv"
                size={34}
                color={isChildMode ? '#f59e0b' : '#38bdf8'}
              />
              <Text style={styles.brandTitle}>IPTV STREAM</Text>
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
                  : currentPath === item.route || currentPath.startsWith(item.route);

              return (
                <Pressable
                  key={item.id}
                  hasTVPreferredFocus={index === 0}
                  onPress={() => router.push(item.route as any)}
                  style={({ focused }) => [
                    styles.navItem,
                    isActive && styles.navItemActive,
                    focused && styles.navItemFocused,
                  ]}
                >
                  {({ focused }) => {
                    const iconColor = focused
                      ? '#000000'
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
                            focused && styles.navItemTextFocused,
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

      {/* مساحة عرض المحتوى الرئيسية */}
      <View style={styles.contentArea}>{children}</View>
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
  },
  sidebar: {
    width: 260,
    backgroundColor: '#0b1120',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
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
  brandTitle: {
    marginLeft: 12,
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.2,
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
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  navItemFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
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
    color: '#000000',
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
    backgroundColor: '#0f172a',
    padding: 32,
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
