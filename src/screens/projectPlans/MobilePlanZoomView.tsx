/**
 * Pinch-to-zoom + drag-to-pan + double-tap zoom dla planu na mobile.
 * Uzywa react-native-gesture-handler + react-native-reanimated.
 * Wydzielony z ProjectPlans.tsx (Faza 2 step 2).
 *
 * Props pozostaja jako 'any' -- shape jest scisle powiazany z parent state
 * (refs, callbacks, complex selectedPlan shape z hooka useProjectPlansData).
 * Pelne typowanie wymaga rozbicia hooka -- osobna iteracja.
 */
import { Dimensions, Image, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { PdfRenderer } from "./PdfRenderer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MobilePlanZoomView({ isDark, addingPin, containerRef, planViewRef, setContainerSize, handlePlanPress, selectedPlan, renderPins }: any) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.5), 6);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1.5) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(3);
        savedScale.value = 3;
      }
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);
  const gesture = Gesture.Race(doubleTap, composed);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const screenW = Dimensions.get("window").width;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          <View
            ref={(ref) => { containerRef.current = ref; planViewRef.current = ref; }}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setContainerSize({ width, height });
            }}
            style={{ position: "relative", width: "100%" }}
            {...(addingPin ? { onTouchEnd: handlePlanPress } : {})}
          >
            {selectedPlan.file_type === "image" ? (
              <Image
                source={{ uri: selectedPlan.file_url }}
                style={{ width: screenW, height: screenW / 1.414 }}
                resizeMode="contain"
              />
            ) : (
              <PdfRenderer url={selectedPlan.file_url} />
            )}
            {renderPins()}
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
