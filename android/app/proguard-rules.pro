# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native's framework classes are protected by the react-android AAR's
# consumer rules, and every Expo module is protected by expo-modules-core's
# consumer rules. The keeps below cover the remaining native libraries that
# register modules/views reflectively (or through the TurboModule interop
# layer), so R8 obfuscation can run everywhere else.

# react-native-reanimated (worklet runtime + Fabric/TurboModule reflection)
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }

# react-native-svg
-keep public class com.horcrux.svg.** { *; }

# react-native-gesture-handler
-keep class com.swmansion.gesturehandler.** { *; }

# react-native-screens
-keep class com.swmansion.rnscreens.** { *; }

# react-native-safe-area-context
-keep class com.th3rdwave.safeareacontext.** { *; }

# react-native-webview
-keep class com.reactnativecommunity.webview.** { *; }

# @react-native-async-storage/async-storage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# @react-native-community/datetimepicker
-keep class com.reactcommunity.rndatetimepicker.** { *; }

# @react-native-community/netinfo
-keep class com.reactnativecommunity.netinfo.** { *; }
