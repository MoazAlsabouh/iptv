import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';

/**
 * بنية عنصر قائمة التنقل
 */
interface NavItem {
  id: string;
  title: string;
  route: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', title: 'Dashboard', route: '/', icon: 'dashboard' },
  { id: 'movies', title: 'Movies', route: '/movies', icon: 'movie' },
  { id: 'live', title: 'Live TV', route: '/live', icon: 'live-tv' },
  { id: 'favorites', title: 'Favorites', route: '/favorites', icon: 'star' },
  { id: 'settings', title: 'Settings', route: '/settings', icon: 'settings' },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * التخطيط الرئيسي للتطبيق (Master-Detail Layout) الموجه لأجهزة التلفاز (TV-First).
 * يحتوي على شريط جانبي وقسم عرض رئيسي، مع دعم كامل لمحرك تركيز ريموت التلفاز (D-Pad)
 * وإمكانية التنقل بين القوائم والمفضلة ومؤشر مرئي لحالة الرقابة الأبوية.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const router = useRouter();
  const currentPath = usePathname();
  const isChildMode = useAppStore((state) => state.isChildMode);

  return (
    <View className="flex-1 flex-row bg-neutral-950">
      {/* الشريط الجانبي (Sidebar - Master View) */}
      <View className="w-72 bg-neutral-900 border-r border-neutral-800 p-6 justify-between">
        <View>
          {/* شعار التطبيق مع مؤشر وضع الطفل إذا كان مفعلاً */}
          <View className="mb-8">
            <View className="flex-row items-center">
              <MaterialIcons
                name="tv"
                size={32}
                color={isChildMode ? '#f59e0b' : '#38bdf8'}
              />
              <Text className="ml-3 text-xl font-bold text-white tracking-wider">
                IPTV STREAM
              </Text>
            </View>

            {/* شارة وضع الطفل المخصص للوالدين */}
            {isChildMode && (
              <View className="mt-2.5 flex-row items-center bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md self-start">
                <MaterialIcons name="lock" size={14} color="#f59e0b" />
                <Text className="ml-1 text-[11px] font-bold text-amber-400">
                  وضع الطفل مفعل
                </Text>
              </View>
            )}
          </View>

          {/* أزرار التنقل مع محرك التركيز لريموت التلفاز */}
          <View className="space-y-3">
            {NAV_ITEMS.map((item, index) => {
              const isActive = currentPath === item.route;

              return (
                <Pressable
                  key={item.id}
                  hasTVPreferredFocus={index === 0}
                  onPress={() => router.push(item.route as any)}
                  className="rounded-xl outline-none"
                >
                  {({ focused }) => (
                    <View
                      className={`flex-row items-center px-4 py-3.5 rounded-xl ${
                        focused
                          ? 'bg-white scale-110 shadow-lg'
                          : isActive
                          ? 'bg-neutral-800'
                          : 'bg-transparent'
                      }`}
                    >
                      <MaterialIcons
                        name={item.icon}
                        size={24}
                        color={
                          focused
                            ? '#000000'
                            : isActive
                            ? item.id === 'favorites'
                              ? '#eab308'
                              : '#38bdf8'
                            : item.id === 'favorites'
                            ? '#ca8a04'
                            : '#a3a3a3'
                        }
                      />
                      <Text
                        className={`ml-3 text-base ${
                          focused
                            ? 'text-black font-bold'
                            : isActive
                            ? 'text-white font-semibold'
                            : 'text-neutral-400 font-medium'
                        }`}
                      >
                        {item.title}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* تذييل إرشادي لمستخدمي ريموت التلفاز */}
        <View className="pt-4 border-t border-neutral-800">
          <Text className="text-xs text-neutral-500 text-center">
            استخدم الأسهم للتنقل و OK للاختيار
          </Text>
        </View>
      </View>

      {/* مساحة عرض المحتوى (Content Area - Detail View) */}
      <View className="flex-1 bg-neutral-950 p-8">
        {children}
      </View>
    </View>
  );
};
