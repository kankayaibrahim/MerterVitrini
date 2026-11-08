# Flutter Wrapper & Engine Rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Flutter Optional Play Core Deferred Components (R8 AGP 9 strict mode)
-dontwarn com.google.android.play.core.**

# Google Tink (flutter_secure_storage encryption)
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**
-dontwarn javax.annotation.**

# AndroidX CameraX (Supplier In-App Textile Camera Studio)
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# AndroidX FileProvider (Self-Hosted OTA APK Self-Updater)
-keep class androidx.core.content.FileProvider { *; }
