import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';

/**
 * شاشة الإعدادات والرقابة الأبوية (Settings & Parental Controls).
 * تتيح التحكم في وضع الطفل (Child Mode) مع حماية برمز PIN من 4 أرقام،
 * وتحتوي على مساحة تمهيدية لمؤقت الإيقاف التلقائي للشاشات الذكية.
 */
export default function SettingsScreen(): React.JSX.Element {
  const { isChildMode, pinCode, setChildMode, setPinCode } = useAppStore();

  const [inputPin, setInputPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);

  /**
   * معالجة تفعيل أو إيقاف وضع الطفل مع التحقق الصارم من رمز الـ PIN
   */
  const handleToggleChildMode = () => {
    setErrorMessage('');
    setSuccessMessage('');

    // التحقق من صحة طول الرمز المدخل
    if (inputPin.trim().length !== 4 || !/^\d{4}$/.test(inputPin.trim())) {
      setErrorMessage('يرجى إدخال رمز PIN صالح مكون من 4 أرقام بالضبط');
      return;
    }

    const cleanPin = inputPin.trim();

    if (isChildMode) {
      // محاولة إلغاء التفعيل: يجب مطابقة الرمز المسجل
      if (cleanPin !== pinCode) {
        setErrorMessage('رمز PIN غير صحيح! لا يمكن إلغاء قفل وضع الطفل');
        return;
      }

      setChildMode(false);
      setInputPin('');
      setSuccessMessage('تم إيقاف وضع الطفل بنجاح، وعرض كافة التصنيفات مجدداً');
    } else {
      // تفعيل وضع الطفل: تسجيل الرمز وتفعيل القفل
      setPinCode(cleanPin);
      setChildMode(true);
      setInputPin('');
      setSuccessMessage('تم تفعيل وضع الطفل بنجاح! تم حجب المحتوى غير المناسب');
    }
  };

  return (
    <View className="flex-1">
      {/* عنوان الشاشة */}
      <View className="mb-6 pb-4 border-b border-neutral-800">
        <Text className="text-2xl font-black text-white">إعدادات التطبيق</Text>
        <Text className="text-neutral-400 text-sm mt-1">
          إدارة الرقابة الأبوية، أمان المحتوى، والمؤقت الزمني للشاشات الذكية
        </Text>
      </View>

      <View className="flex-row space-x-6">
        {/* 1. قسم وضع الطفل والرقابة الأبوية */}
        <View className="flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 justify-between">
          <View>
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View
                  className={`p-3 rounded-xl ${
                    isChildMode ? 'bg-amber-500/20' : 'bg-neutral-800'
                  }`}
                >
                  <MaterialIcons
                    name={isChildMode ? 'child-care' : 'family-restroom'}
                    size={28}
                    color={isChildMode ? '#f59e0b' : '#38bdf8'}
                  />
                </View>
                <View className="ml-3">
                  <Text className="text-lg font-bold text-white">
                    وضع الرقابة الأبوية (وضع الطفل)
                  </Text>
                  <Text className="text-xs text-neutral-400">
                    فلترة تصنيفات العنف، الرعب، والأخبار تلقائياً
                  </Text>
                </View>
              </View>

              {/* شارة الحالة الحالية */}
              <View
                className={`px-3 py-1.5 rounded-full ${
                  isChildMode ? 'bg-amber-500/20' : 'bg-neutral-800'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    isChildMode ? 'text-amber-400' : 'text-neutral-400'
                  }`}
                >
                  {isChildMode ? 'مفعل الآن' : 'غير مفعل'}
                </Text>
              </View>
            </View>

            <Text className="text-neutral-300 text-sm mb-4 leading-6">
              {isChildMode
                ? 'وضع الطفل قيد التشغيل حالياً. لإيقافه والسماح بجميع القنوات، أدخل رمز PIN المسجل أدناه:'
                : 'لحماية أطفالك وتصفية المحتوى الموجه للبالغين، قم بتعيين رمز PIN مكون من 4 أرقام ثم اضغط تفعيل:'}
            </Text>

            {/* حقل إدخال رمز PIN المخصص للتلفاز */}
            <View
              className={`flex-row items-center bg-neutral-950 px-4 py-3.5 rounded-xl border mb-3 ${
                isInputFocused
                  ? 'border-white bg-neutral-900 scale-105'
                  : 'border-neutral-800'
              }`}
            >
              <MaterialIcons
                name="lock-outline"
                size={22}
                color={isInputFocused ? '#38bdf8' : '#737373'}
              />
              <TextInput
                value={inputPin}
                onChangeText={setInputPin}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="أدخل رمز PIN (مثال: 1234)"
                placeholderTextColor="#737373"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                className="flex-1 ml-3 text-white text-base tracking-widest outline-none"
              />
            </View>

            {/* رسائل التنبيه والخطأ */}
            {errorMessage ? (
              <Text className="text-red-400 text-xs font-semibold mb-3">
                {errorMessage}
              </Text>
            ) : null}

            {successMessage ? (
              <Text className="text-emerald-400 text-xs font-semibold mb-3">
                {successMessage}
              </Text>
            ) : null}
          </View>

          {/* زر تبديل الحالة المهيأ بالكامل لريموت التلفاز */}
          <Pressable
            hasTVPreferredFocus
            onPress={handleToggleChildMode}
            className="rounded-xl outline-none mt-4"
          >
            {({ focused }) => (
              <View
                className={`py-3.5 rounded-xl flex-row justify-center items-center ${
                  focused
                    ? 'bg-white scale-105 shadow-xl'
                    : isChildMode
                    ? 'bg-red-600'
                    : 'bg-amber-500'
                }`}
              >
                <MaterialIcons
                  name={isChildMode ? 'lock-open' : 'lock'}
                  size={20}
                  color={focused ? '#000000' : '#ffffff'}
                />
                <Text
                  className={`ml-2 text-base font-bold ${
                    focused ? 'text-black font-extrabold' : 'text-white'
                  }`}
                >
                  {isChildMode ? 'إلغاء قفل وضع الطفل' : 'تفعيل وضع الطفل وقفل التصنيفات'}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* 2. قسم المؤقت الزمني (UI Placeholder للمهام القادمة) */}
        <View className="flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 justify-between ml-6">
          <View>
            <View className="flex-row items-center mb-4">
              <View className="p-3 rounded-xl bg-neutral-800">
                <MaterialIcons name="timer" size={28} color="#38bdf8" />
              </View>
              <View className="ml-3">
                <Text className="text-lg font-bold text-white">
                  مؤقت المشاهدة الذكي
                </Text>
                <Text className="text-xs text-neutral-400">
                  إيقاف التشغيل التلقائي بعد مدة محددة
                </Text>
              </View>
            </View>

            <View className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-neutral-300 font-semibold text-sm">
                  المدة المحددة افتراضياً:
                </Text>
                <Text className="text-sky-400 font-bold text-sm">
                  ساعتان (120 دقيقة)
                </Text>
              </View>
              <Text className="text-neutral-500 text-xs leading-5">
                عند انتهاء العداد التنازلي للمؤقت، سيتم قفل المشغل تلقائياً ولن يتمكن الطفل من
                متابعة المشاهدة إلا بعد فتح القفل بواسطة الوالدين.
              </Text>
            </View>
          </View>

          {/* زر تمهيدي غير نشط يوضح الميزة القادمة */}
          <Pressable
            disabled
            className="rounded-xl outline-none opacity-60"
          >
            <View className="py-3.5 rounded-xl flex-row justify-center items-center bg-neutral-800 border border-neutral-700">
              <MaterialIcons name="hourglass-empty" size={20} color="#9ca3af" />
              <Text className="ml-2 text-sm font-semibold text-neutral-400">
                المؤقت الزمني التلقائي (قريباً)
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
