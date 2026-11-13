import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/localization.dart';
import '../../models/marketplace.dart';
import '../../providers/session_provider.dart';
import '../../widgets/editorial_ui.dart';
import '../../widgets/smart_network_image.dart';

String _stripHtmlTags(String html) {
  return html
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</(p|div|h[1-6]|li|tr)>', caseSensitive: false), '\n\n')
      .replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '• ')
      .replaceAll(RegExp(r'<[^>]*>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();
}

class BlogAndCmsScreen extends StatefulWidget {
  final int initialTabIndex;

  const BlogAndCmsScreen({super.key, this.initialTabIndex = 0});

  @override
  State<BlogAndCmsScreen> createState() => _BlogAndCmsScreenState();
}

class _BlogAndCmsScreenState extends State<BlogAndCmsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  List<BlogPostItem> _posts = <BlogPostItem>[];
  bool _loadingPosts = true;
  String? _postsError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTabIndex.clamp(0, 1),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SessionProvider>().telemetry.trackScreenView(
            path: '/blog',
            pageTitle: 'B2B Blog & Legal Policies',
          );
      _loadPosts();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadPosts() async {
    setState(() {
      _loadingPosts = true;
      _postsError = null;
    });
    try {
      final list = await context.read<SessionProvider>().api.listBlogPosts();
      if (!mounted) return;
      setState(() => _posts = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _postsError = e.toString());
    } finally {
      if (mounted) setState(() => _loadingPosts = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final lang = session.languageCode;
    final dateFmt = DateFormat('dd.MM.yyyy');

    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          AppStrings.tUpper(lang, 'blog_title'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontFamily: AppColors.serifFontFamily,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            letterSpacing: AppStrings.letterSpacing(lang, 1.0),
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.obsidian,
          unselectedLabelColor: AppColors.sonicSilver,
          indicatorColor: AppColors.obsidian,
          labelStyle: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
          tabs: [
            Tab(text: AppStrings.t(lang, 'blog_title')),
            Tab(text: AppStrings.t(lang, 'legal_policies')),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // 1. B2B Blog & Export Guides
          _loadingPosts
              ? const Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.obsidian,
                  ),
                )
              : _postsError != null
                  ? EditorialEmptyState(
                      icon: Icons.error_outline_rounded,
                      title: AppStrings.t(lang, 'error'),
                      subtitle: _postsError!,
                      actionLabel: AppStrings.t(lang, 'retry'),
                      onAction: _loadPosts,
                    )
                  : _posts.isEmpty
                      ? EditorialEmptyState(
                          icon: Icons.article_outlined,
                          title: AppStrings.t(lang, 'no_results'),
                          subtitle: UiText.pick(
                            lang,
                            tr: 'Henüz yayınlanmış B2B ihracat yazısı bulunmuyor.',
                            en: 'No published B2B export articles yet.',
                            ru: 'Опубликованных B2B статей пока нет.',
                            ar: 'لا توجد مقالات تصدير B2B منشورة حتى الآن.',
                            de: 'Noch keine B2B-Exportartikel veröffentlicht.',
                            fr: 'Aucun article d’export B2B publié pour le moment.',
                            pl: 'Brak opublikowanych artykułów eksportowych B2B.',
                            bg: 'Все още няма публикувани B2B статии.',
                          ),
                        )
                      : RefreshIndicator(
                          color: AppColors.obsidian,
                          onRefresh: _loadPosts,
                          child: ListView.separated(
                            padding: const EdgeInsets.all(14),
                            itemCount: _posts.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 12),
                            itemBuilder: (context, index) {
                              final post = _posts[index];
                              final slug = post.slug.isNotEmpty
                                  ? post.slug
                                  : post.id;
                              return EditorialCard(
                                padding: const EdgeInsets.all(14),
                                onTap: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute<void>(
                                      builder: (_) => BlogDetailScreen(
                                        slug: slug,
                                        initialPost: post,
                                      ),
                                    ),
                                  );
                                },
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (post.coverImage != null &&
                                        post.coverImage!.isNotEmpty) ...[
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(
                                          AppColors.radiusSm,
                                        ),
                                        child: AspectRatio(
                                          aspectRatio: 16 / 9,
                                          child: SmartNetworkImage(
                                            imageUrl: post.coverImage!,
                                            fit: BoxFit.cover,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                    ],
                                    Text(
                                      dateFmt.format(post.createdAt.toLocal()),
                                      style: const TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.editorialGold,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      post.localizedTitle(lang),
                                      style: const TextStyle(
                                        fontFamily: AppColors.serifFontFamily,
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.obsidian,
                                      ),
                                    ),
                                    if (post
                                        .localizedSummary(lang)
                                        .isNotEmpty) ...[
                                      const SizedBox(height: 6),
                                      Text(
                                        _stripHtmlTags(
                                          post.localizedSummary(lang),
                                        ),
                                        maxLines: 3,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 12.5,
                                          color: AppColors.sonicSilver,
                                          height: 1.45,
                                        ),
                                      ),
                                    ],
                                    const SizedBox(height: 10),
                                    Row(
                                      children: [
                                        Text(
                                          AppStrings.t(lang, 'read_more'),
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.obsidian,
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        const Icon(
                                          Icons.arrow_forward_rounded,
                                          size: 14,
                                          color: AppColors.obsidian,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),

          // 2. CMS Pages & Active Legal Policies
          ListView(
            padding: const EdgeInsets.all(14),
            children: [
              _LegalRowCard(
                icon: Icons.info_outline_rounded,
                title: AppStrings.t(lang, 'about_page'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CmsAndPolicyViewerScreen(
                      title: AppStrings.t(lang, 'about_page'),
                      cmsSlug: 'about',
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _LegalRowCard(
                icon: Icons.shield_outlined,
                title: AppStrings.t(lang, 'privacy_policy'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CmsAndPolicyViewerScreen(
                      title: AppStrings.t(lang, 'privacy_policy'),
                      policyType: 'privacy',
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _LegalRowCard(
                icon: Icons.description_outlined,
                title: AppStrings.t(lang, 'terms_of_service'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CmsAndPolicyViewerScreen(
                      title: AppStrings.t(lang, 'terms_of_service'),
                      policyType: 'terms',
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _LegalRowCard(
                icon: Icons.assignment_return_outlined,
                title: AppStrings.t(lang, 'cancellation_return'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CmsAndPolicyViewerScreen(
                      title: AppStrings.t(lang, 'cancellation_return'),
                      policyType: 'cancellation',
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LegalRowCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _LegalRowCard({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return EditorialCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppColors.warmIvory,
              borderRadius: BorderRadius.circular(AppColors.radiusSm),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 19, color: AppColors.obsidian),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontFamily: AppColors.serifFontFamily,
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
              ),
            ),
          ),
          const Icon(
            Icons.chevron_right_rounded,
            color: AppColors.sonicSilver,
          ),
        ],
      ),
    );
  }
}

class BlogDetailScreen extends StatefulWidget {
  final String slug;
  final BlogPostItem? initialPost;

  const BlogDetailScreen({
    super.key,
    required this.slug,
    this.initialPost,
  });

  @override
  State<BlogDetailScreen> createState() => _BlogDetailScreenState();
}

class _BlogDetailScreenState extends State<BlogDetailScreen> {
  BlogPostItem? _post;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _post = widget.initialPost;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res =
          await context.read<SessionProvider>().api.fetchBlogPostBySlug(
                widget.slug,
              );
      if (!mounted) return;
      setState(() => _post = res);
    } catch (e) {
      if (!mounted) return;
      if (_post == null) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;
    final p = _post;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          p?.localizedTitle(lang) ?? AppStrings.t(lang, 'blog_title'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
      ),
      body: p == null && _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.obsidian,
              ),
            )
          : p == null && _error != null
              ? EditorialEmptyState(
                  icon: Icons.error_outline_rounded,
                  title: AppStrings.t(lang, 'error'),
                  subtitle: _error!,
                  actionLabel: AppStrings.t(lang, 'retry'),
                  onAction: _load,
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (p!.coverImage != null && p.coverImage!.isNotEmpty) ...[
                        ClipRRect(
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusMd),
                          child: AspectRatio(
                            aspectRatio: 16 / 9,
                            child: SmartNetworkImage(
                              imageUrl: p.coverImage!,
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      Text(
                        p.localizedTitle(lang),
                        style: const TextStyle(
                          fontFamily: AppColors.serifFontFamily,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: AppColors.obsidian,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _stripHtmlTags(p.localizedContent(lang)),
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppColors.onyx,
                          height: 1.65,
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}

class CmsAndPolicyViewerScreen extends StatefulWidget {
  final String title;
  final String? cmsSlug;
  final String? policyType;

  const CmsAndPolicyViewerScreen({
    super.key,
    required this.title,
    this.cmsSlug,
    this.policyType,
  });

  @override
  State<CmsAndPolicyViewerScreen> createState() =>
      _CmsAndPolicyViewerScreenState();
}

class _CmsAndPolicyViewerScreenState extends State<CmsAndPolicyViewerScreen> {
  String _heading = '';
  String _body = '';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _heading = widget.title;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final session = context.read<SessionProvider>();
    final lang = session.languageCode;
    try {
      if (widget.cmsSlug != null && widget.cmsSlug!.isNotEmpty) {
        final page = await session.api.fetchCmsPageBySlug(widget.cmsSlug!);
        if (!mounted) return;
        setState(() {
          final t = page.localizedTitle(lang);
          _heading = t.isNotEmpty ? t : widget.title;
          _body = _stripHtmlTags(page.localizedContent(lang));
        });
      } else if (widget.policyType != null && widget.policyType!.isNotEmpty) {
        final policy = await session.api.fetchActivePolicy(widget.policyType!);
        if (!mounted) return;
        setState(() {
          _heading =
              policy.title.isNotEmpty ? policy.title : widget.title;
          _body = _stripHtmlTags(policy.content);
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<SessionProvider>().languageCode;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.obsidian,
        title: Text(
          _heading,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.obsidian,
              ),
            )
          : _error != null
              ? EditorialEmptyState(
                  icon: Icons.error_outline_rounded,
                  title: AppStrings.t(lang, 'error'),
                  subtitle: _error!,
                  actionLabel: AppStrings.t(lang, 'retry'),
                  onAction: _load,
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _heading,
                        style: const TextStyle(
                          fontFamily: AppColors.serifFontFamily,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: AppColors.obsidian,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        _body,
                        style: const TextStyle(
                          fontSize: 13.8,
                          color: AppColors.onyx,
                          height: 1.65,
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
