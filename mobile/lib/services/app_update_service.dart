import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../core/app_config.dart';

class InstalledAppInfo {
  final String version;
  final int buildNumber;
  final String packageName;
  final String updateDir;
  final bool canInstall;

  const InstalledAppInfo({
    required this.version,
    required this.buildNumber,
    required this.packageName,
    required this.updateDir,
    required this.canInstall,
  });

  String get displayLabel => 'v$version ($buildNumber)';
}

class AppReleaseInfo {
  final String appName;
  final String packageId;
  final String version;
  final int buildNumber;
  final int minBuildNumber;
  final bool forceUpdate;
  final String apkFilename;
  final String downloadUrl;
  final String webPageUrl;
  final String sha256;
  final int fileSizeBytes;
  final String publishedAt;
  final bool apkAvailable;
  final Map<String, String> releaseNotes;

  const AppReleaseInfo({
    required this.appName,
    required this.packageId,
    required this.version,
    required this.buildNumber,
    required this.minBuildNumber,
    required this.forceUpdate,
    required this.apkFilename,
    required this.downloadUrl,
    required this.webPageUrl,
    required this.sha256,
    required this.fileSizeBytes,
    required this.publishedAt,
    required this.apkAvailable,
    required this.releaseNotes,
  });

  factory AppReleaseInfo.fromJson(Map<String, dynamic> json) {
    final rawNotes = json['release_notes'];
    final parsedNotes = <String, String>{};
    if (rawNotes is Map) {
      for (final entry in rawNotes.entries) {
        parsedNotes[entry.key.toString()] = entry.value?.toString() ?? '';
      }
    }

    return AppReleaseInfo(
      appName: (json['app_name'] ?? AppConfig.appName).toString(),
      packageId: (json['package_id'] ?? AppConfig.packageId).toString(),
      version: (json['version'] ?? '1.0.0').toString(),
      buildNumber: _toInt(json['build_number'], fallback: 1),
      minBuildNumber: _toInt(json['min_build_number'], fallback: 1),
      forceUpdate: json['force_update'] == true,
      apkFilename: (json['apk_filename'] ?? 'mertervitrini-latest.apk')
          .toString(),
      downloadUrl: AppConfig.resolveMediaUrl(
        (json['download_url'] ?? '/api/v1/mobile/apk').toString(),
      ),
      webPageUrl: AppConfig.resolveMediaUrl(
        (json['web_page_url'] ?? '/mobil-uygulama').toString(),
      ),
      sha256: (json['sha256'] ?? '').toString().trim().toLowerCase(),
      fileSizeBytes: _toInt(json['file_size_bytes'], fallback: 0),
      publishedAt: (json['published_at'] ?? '').toString(),
      apkAvailable: json['apk_available'] == true,
      releaseNotes: parsedNotes,
    );
  }

  static int _toInt(dynamic value, {required int fallback}) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value.trim()) ?? fallback;
    return fallback;
  }

  String get displayLabel => 'v$version ($buildNumber)';

  String get formattedSize {
    if (fileSizeBytes <= 0) return '';
    final mb = fileSizeBytes / (1024 * 1024);
    return '${mb.toStringAsFixed(1)} MB';
  }

  String localizedNotes(String lang) {
    final direct = releaseNotes[lang];
    if (direct != null && direct.trim().isNotEmpty) {
      return direct.trim();
    }
    final tr = releaseNotes['tr'];
    if (tr != null && tr.trim().isNotEmpty) {
      return tr.trim();
    }
    final en = releaseNotes['en'];
    if (en != null && en.trim().isNotEmpty) {
      return en.trim();
    }
    return 'Performans, güvenlik ve katalog iyileştirmeleri içerir.';
  }
}

class UpdateCheckResult {
  final InstalledAppInfo installed;
  final AppReleaseInfo remote;
  final bool hasUpdate;
  final bool isForceUpdate;

  const UpdateCheckResult({
    required this.installed,
    required this.remote,
    required this.hasUpdate,
    required this.isForceUpdate,
  });
}

enum ApkInstallTriggerStatus {
  installerLaunched,
  permissionRequired,
}

class AppUpdateService {
  static const MethodChannel _channel = MethodChannel(
    'com.mertervitrini.app/ota_updater',
  );

  const AppUpdateService();

  static bool get supportsInAppApkUpdate =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  static int compareSemanticVersions(String a, String b) {
    List<int> parseParts(String v) {
      final clean = v.split('+').first.split('-').first.trim();
      return clean
          .split('.')
          .map((seg) => int.tryParse(seg.trim()) ?? 0)
          .toList();
    }

    final pa = parseParts(a);
    final pb = parseParts(b);
    final maxLen = pa.length > pb.length ? pa.length : pb.length;
    for (var i = 0; i < maxLen; i++) {
      final va = i < pa.length ? pa[i] : 0;
      final vb = i < pb.length ? pb[i] : 0;
      if (va != vb) {
        return va > vb ? 1 : -1;
      }
    }
    return 0;
  }

  static bool isRemoteNewer({
    required String localVersion,
    required int localBuild,
    required String remoteVersion,
    required int remoteBuild,
  }) {
    final semDiff = compareSemanticVersions(remoteVersion, localVersion);
    if (semDiff > 0) return true;
    if (semDiff < 0) return false;
    return remoteBuild > localBuild;
  }

  Future<InstalledAppInfo> getInstalledAppInfo() async {
    if (supportsInAppApkUpdate) {
      try {
        final raw = await _channel.invokeMapMethod<String, dynamic>(
          'getAppInfo',
        );
        if (raw != null) {
          return InstalledAppInfo(
            version: (raw['version'] ?? '1.0.0').toString(),
            buildNumber: (raw['buildNumber'] as num?)?.toInt() ?? 1,
            packageName:
                (raw['packageName'] ?? AppConfig.packageId).toString(),
            updateDir: (raw['updateDir'] ?? '').toString(),
            canInstall: raw['canInstall'] == true,
          );
        }
      } catch (_) {
        // Fallback to PackageInfo below
      }
    }

    try {
      final pkg = await PackageInfo.fromPlatform();
      String tempPath = '';
      if (!kIsWeb) {
        try {
          final tmp = await getTemporaryDirectory();
          final dir = Directory(p.join(tmp.path, 'apk_updates'));
          if (!dir.existsSync()) {
            dir.createSync(recursive: true);
          }
          tempPath = dir.path;
        } catch (_) {}
      }
      return InstalledAppInfo(
        version: pkg.version.isNotEmpty ? pkg.version : '1.0.0',
        buildNumber: int.tryParse(pkg.buildNumber) ?? 1,
        packageName:
            pkg.packageName.isNotEmpty ? pkg.packageName : AppConfig.packageId,
        updateDir: tempPath,
        canInstall: false,
      );
    } catch (_) {
      return const InstalledAppInfo(
        version: '1.0.0',
        buildNumber: 1,
        packageName: AppConfig.packageId,
        updateDir: '',
        canInstall: false,
      );
    }
  }

  Future<UpdateCheckResult> checkForUpdate(Dio dio) async {
    final installed = await getInstalledAppInfo();
    final response = await dio.get<dynamic>(
      '/api/v1/mobile/version',
      queryParameters: <String, dynamic>{
        '_t': DateTime.now().millisecondsSinceEpoch,
      },
      options: Options(
        headers: const <String, dynamic>{'Cache-Control': 'no-cache'},
      ),
    );

    final data = response.data;
    if (data is! Map) {
      throw Exception('Güncelleme bilgisi okunamadı.');
    }

    final remote = AppReleaseInfo.fromJson(Map<String, dynamic>.from(data));
    final newer = remote.apkAvailable &&
        isRemoteNewer(
          localVersion: installed.version,
          localBuild: installed.buildNumber,
          remoteVersion: remote.version,
          remoteBuild: remote.buildNumber,
        );

    final forced = newer &&
        (remote.forceUpdate || installed.buildNumber < remote.minBuildNumber);

    return UpdateCheckResult(
      installed: installed,
      remote: remote,
      hasUpdate: newer,
      isForceUpdate: forced,
    );
  }

  Future<String> downloadAndVerifyApk({
    required AppReleaseInfo release,
    required InstalledAppInfo installed,
    required void Function(int received, int total) onProgress,
    CancelToken? cancelToken,
  }) async {
    if (!supportsInAppApkUpdate) {
      throw UnsupportedError(
        'Otomatik APK kurulumu yalnızca Android cihazlarda desteklenir.',
      );
    }

    String targetDir = installed.updateDir;
    if (targetDir.isEmpty) {
      final tmp = await getTemporaryDirectory();
      final dir = Directory(p.join(tmp.path, 'apk_updates'));
      if (!dir.existsSync()) {
        dir.createSync(recursive: true);
      }
      targetDir = dir.path;
    }

    final fileName =
        'mertervitrini-v${release.version}+${release.buildNumber}.apk';
    final finalPath = p.join(targetDir, fileName);
    final finalFile = File(finalPath);

    // Reuse cached APK if already downloaded and verified
    if (finalFile.existsSync() && finalFile.lengthSync() > 0) {
      if (release.sha256.isNotEmpty) {
        final existingHash = await computeFileSha256(finalPath);
        if (existingHash == release.sha256) {
          final len = finalFile.lengthSync();
          onProgress(len, len);
          return finalPath;
        }
      }
      try {
        finalFile.deleteSync();
      } catch (_) {}
    }

    final partPath = '$finalPath.part';
    final partFile = File(partPath);
    if (partFile.existsSync()) {
      try {
        partFile.deleteSync();
      } catch (_) {}
    }

    final downloadDio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(minutes: 15),
        followRedirects: true,
      ),
    );

    await downloadDio.download(
      release.downloadUrl,
      partPath,
      cancelToken: cancelToken,
      onReceiveProgress: (received, total) {
        final effectiveTotal = total > 0 ? total : release.fileSizeBytes;
        onProgress(received, effectiveTotal);
      },
    );

    if (!partFile.existsSync() || partFile.lengthSync() <= 0) {
      throw Exception('APK dosyası indirilemedi.');
    }

    if (release.sha256.isNotEmpty) {
      final actualHash = await computeFileSha256(partPath);
      if (actualHash != release.sha256) {
        try {
          partFile.deleteSync();
        } catch (_) {}
        throw Exception(
          'İndirilen paket doğrulama kontrolünden geçemedi (SHA-256 uyuşmazlığı). Lütfen tekrar deneyin.',
        );
      }
    }

    await partFile.rename(finalPath);
    return finalPath;
  }

  Future<String> computeFileSha256(String filePath) async {
    final hash = await _channel.invokeMethod<String>(
      'sha256File',
      <String, dynamic>{'filePath': filePath},
    );
    return (hash ?? '').trim().toLowerCase();
  }

  Future<ApkInstallTriggerStatus> triggerInstallApk(String filePath) async {
    final status = await _channel.invokeMethod<String>(
      'installApk',
      <String, dynamic>{'filePath': filePath},
    );
    if (status == 'permission_required') {
      return ApkInstallTriggerStatus.permissionRequired;
    }
    return ApkInstallTriggerStatus.installerLaunched;
  }
}

