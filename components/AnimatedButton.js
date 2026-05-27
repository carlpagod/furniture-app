import React, { useRef } from 'react';
import { Pressable, Animated, Platform, StyleSheet } from 'react-native';

export default function AnimatedButton({ children, onPress, style, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  }

  function handleHoverIn() {
    if (Platform.OS === 'web') {
      Animated.spring(scale, {
        toValue: 1.02,
        useNativeDriver: true,
        tension: 100,
        friction: 5,
      }).start();
    }
  }

  function handleHoverOut() {
    if (Platform.OS === 'web') {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 5,
      }).start();
    }
  }

  const flatStyle = StyleSheet.flatten(style) || {};
  
  const pressableStyle = {
    flex: flatStyle.flex,
    width: flatStyle.width,
    height: flatStyle.height,
    margin: flatStyle.margin,
    marginHorizontal: flatStyle.marginHorizontal,
    marginVertical: flatStyle.marginVertical,
    marginTop: flatStyle.marginTop,
    marginBottom: flatStyle.marginBottom,
    marginLeft: flatStyle.marginLeft,
    marginRight: flatStyle.marginRight,
    position: flatStyle.position,
    top: flatStyle.top,
    bottom: flatStyle.bottom,
    left: flatStyle.left,
    right: flatStyle.right,
    alignSelf: flatStyle.alignSelf,
    overflow: 'visible',
  };

  const innerStyle = {
    ...flatStyle,
    flex: undefined,
    margin: undefined,
    marginHorizontal: undefined,
    marginVertical: undefined,
    marginTop: undefined,
    marginBottom: undefined,
    marginLeft: undefined,
    marginRight: undefined,
    position: undefined,
    top: undefined,
    bottom: undefined,
    left: undefined,
    right: undefined,
    alignSelf: undefined,
    width: flatStyle.width ? '100%' : undefined,
    height: flatStyle.height ? '100%' : undefined,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      style={pressableStyle}
    >
      <Animated.View style={[innerStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
