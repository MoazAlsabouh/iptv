import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TVPlayerPlaybackState } from './TVPlayer';

export type BottomControlTarget =
  | 'seekbar'
  | 'playPause'
  | 'rewind'
  | 'forward'
  | 'audio'
  | 'subtitles'
  | 'aspectRatio';

export interface TVPlayerControlsProps {
  visible: boolean;
  isEmbed?: boolean;
  playbackState: TVPlayerPlaybackState | null;
  focusedTarget?: BottomControlTarget | null;
  contentFit?: 'contain' | 'cover' | 'fill';
  onPlayPause: () => void;
  onSeekTo: (seconds: number) => void;
  onSeekBy: (seconds: number) => void;
  onOpenAudioModal: () => void;
  onOpenSubtitleModal: () => void;
  onToggleAspectRatio: () => void;
  onInteraction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function formatVideoTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export const TVPlayerControls: React.FC<TVPlayerControlsProps> = memo(({
  visible,
  isEmbed = false,
  playbackState,
  focusedTarget,
  contentFit = 'contain',
  onPlayPause,
  onSeekTo,
  onSeekBy,
  onOpenAudioModal,
  onOpenSubtitleModal,
  onToggleAspectRatio,
  onInteraction,
  style,
}) => {
  if (!visible || isEmbed) {
    return null;
  }

  const isPlaying = playbackState?.isPlaying ?? false;
  const currentTime = playbackState?.currentTime ?? 0;
  const duration = playbackState?.duration ?? 0;
  const isLive = playbackState?.isLive || duration <= 0;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const hasAudioTracks = (playbackState?.audioTracks?.length ?? 0) > 0;
  const hasSubtitles = (playbackState?.subtitleTracks?.length ?? 0) > 0;
  const isMuted = playbackState?.isMuted ?? false;

  const handleSeekbarPress = (e: any) => {
    onInteraction?.();
    if (isLive || duration <= 0) return;
    const { locationX } = e.nativeEvent;
    // تقدير العرض عبر قياسات النقر
    const targetWidth = e.currentTarget?.offsetWidth || 300;
    const fraction = Math.min(1, Math.max(0, locationX / targetWidth));
    onSeekTo(fraction * duration);
  };

  const getAspectLabel = () => {
    if (contentFit === 'contain') return 'ملاءمة (Contain)';
    if (contentFit === 'cover') return 'تعبئة وقص (Cover)';
    return 'ملء الشاشة (Stretch)';
  };

  return (
    <View
      style={[styles.container, style]}
      pointerEvents="box-none"
      onTouchStart={onInteraction}
    >
      <View style={styles.glassBackground}>
        {/* شريط التقدم الزمني / البث المباشر */}
        <View style={styles.seekbarContainer}>
          <Text style={styles.timeText}>{formatVideoTime(currentTime)}</Text>

          {isLive ? (
            <View style={styles.liveBarContainer}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>مباشر LIVE</Text>
              </View>
            </View>
          ) : (
            <Pressable
              focusable={false}
              onPress={handleSeekbarPress}
              style={[
                styles.seekbarTrackWrapper,
                focusedTarget === 'seekbar' && styles.seekbarFocusedGlow,
              ]}
            >
              <View style={styles.seekbarTrack}>
                <View style={[styles.seekbarProgress, { width: `${progressPercent}%` }]} />
                <View
                  style={[
                    styles.seekbarThumb,
                    { left: `${progressPercent}%` },
                    focusedTarget === 'seekbar' && styles.seekbarThumbFocused,
                  ]}
                />
              </View>
            </Pressable>
          )}

          <Text style={styles.timeText}>
            {isLive ? '--:--' : formatVideoTime(duration)}
          </Text>
        </View>

        {/* صف أزرار التحكم */}
        <View style={styles.buttonsRow}>
          {/* الجانب الأيمن (تشغيل / إيقاف / تقديم / تأخير) */}
          <View style={styles.actionGroup}>
            {/* زر تشغيل / إيقاف مؤقت */}
            <Pressable
              focusable={false}
              onPress={() => {
                onInteraction?.();
                onPlayPause();
              }}
              style={[
                styles.controlBtn,
                styles.primaryBtn,
                focusedTarget === 'playPause' && styles.btnFocused,
              ]}
            >
              <MaterialIcons
                name={isPlaying ? 'pause' : 'play-arrow'}
                size={26}
                color={focusedTarget === 'playPause' ? '#000000' : '#ffffff'}
              />
            </Pressable>

            {/* زر تأخير 10 ثوانٍ */}
            {!isLive && (
              <Pressable
                focusable={false}
                onPress={() => {
                  onInteraction?.();
                  onSeekBy(-10);
                }}
                style={[
                  styles.controlBtn,
                  focusedTarget === 'rewind' && styles.btnFocused,
                ]}
              >
                <MaterialIcons
                  name="replay-10"
                  size={24}
                  color={focusedTarget === 'rewind' ? '#000000' : '#ffffff'}
                />
              </Pressable>
            )}

            {/* زر تقديم 10 ثوانٍ */}
            {!isLive && (
              <Pressable
                focusable={false}
                onPress={() => {
                  onInteraction?.();
                  onSeekBy(10);
                }}
                style={[
                  styles.controlBtn,
                  focusedTarget === 'forward' && styles.btnFocused,
                ]}
              >
                <MaterialIcons
                  name="forward-10"
                  size={24}
                  color={focusedTarget === 'forward' ? '#000000' : '#ffffff'}
                />
              </Pressable>
            )}
          </View>

          {/* الجانب الأيسر (مسارات الصوت / الترجمة / أبعاد الشاشة) */}
          <View style={styles.actionGroup}>
            {/* زر مسارات الصوت */}
            <Pressable
              focusable={false}
              onPress={() => {
                onInteraction?.();
                onOpenAudioModal();
              }}
              style={[
                styles.labeledBtn,
                focusedTarget === 'audio' && styles.btnFocused,
              ]}
            >
              <MaterialIcons
                name={isMuted ? 'volume-off' : 'volume-up'}
                size={20}
                color={focusedTarget === 'audio' ? '#000000' : isMuted ? '#ef4444' : '#38bdf8'}
              />
              <Text style={[styles.labeledBtnText, focusedTarget === 'audio' && styles.textFocused]}>
                الصوت
              </Text>
            </Pressable>

            {/* زر الترجمة */}
            <Pressable
              focusable={false}
              onPress={() => {
                onInteraction?.();
                onOpenSubtitleModal();
              }}
              style={[
                styles.labeledBtn,
                focusedTarget === 'subtitles' && styles.btnFocused,
              ]}
            >
              <MaterialIcons
                name="subtitles"
                size={20}
                color={focusedTarget === 'subtitles' ? '#000000' : '#38bdf8'}
              />
              <Text style={[styles.labeledBtnText, focusedTarget === 'subtitles' && styles.textFocused]}>
                الترجمة
              </Text>
            </Pressable>

            {/* زر نسبة العرض وتغيير أبعاد الصورة */}
            <Pressable
              focusable={false}
              onPress={() => {
                onInteraction?.();
                onToggleAspectRatio();
              }}
              style={[
                styles.labeledBtn,
                focusedTarget === 'aspectRatio' && styles.btnFocused,
              ]}
            >
              <MaterialIcons
                name="aspect-ratio"
                size={20}
                color={focusedTarget === 'aspectRatio' ? '#000000' : '#38bdf8'}
              />
              <Text style={[styles.labeledBtnText, focusedTarget === 'aspectRatio' && styles.textFocused]}>
                {contentFit === 'contain' ? 'ملاءمة' : contentFit === 'cover' ? 'تعبئة' : 'تمدد'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: 28,
    zIndex: 20,
  },
  glassBackground: {
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  seekbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  timeText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 48,
    textAlign: 'center',
  },
  seekbarTrackWrapper: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  seekbarFocusedGlow: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 16,
  },
  seekbarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  seekbarProgress: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: 3,
  },
  seekbarThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#38bdf8',
    marginLeft: -7,
  },
  seekbarThumbFocused: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginLeft: -10,
    borderWidth: 3,
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  liveBarContainer: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  labeledBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 6,
  },
  labeledBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  btnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#38bdf8',
    transform: [{ scale: 1.08 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  textFocused: {
    color: '#000000',
    fontWeight: '800',
  },
});
