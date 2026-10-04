<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Merter Vitrini | <#nested "header"></title>
    <link rel="icon" href="https://mertervitrini.com.tr/favicon.ico" />
    
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
</head>

<body>
<div class="mv-login-page">

    <!-- Top Navigation Bar -->
    <header class="mv-navbar">
        <a href="https://mertervitrini.com.tr" class="mv-brand-link">
            <div class="mv-brand-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
                    <path d="M9 22v-4h6v4"/>
                    <path d="M8 6h.01"/>
                    <path d="M16 6h.01"/>
                    <path d="M8 10h.01"/>
                    <path d="M16 10h.01"/>
                    <path d="M8 14h.01"/>
                    <path d="M16 14h.01"/>
                </svg>
            </div>
            <div class="mv-brand-text">
                <span class="mv-brand-name">MERTER VİTRİNİ</span>
                <span class="mv-brand-subtitle">${msg("mvBrandSubtitle")}</span>
            </div>
        </a>

        <!-- Multilingual Language Selector -->
        <#if realm.internationalizationEnabled?? && realm.internationalizationEnabled && (locale.supported??) && (locale.supported?size > 1)>
            <nav class="mv-lang-selector" aria-label="Languages">
                <#list locale.supported as l>
                    <a href="${l.url}" class="mv-lang-btn <#if (locale.currentLanguageTag!'') == (l.languageTag!'')>active</#if>">
                        <#if (l.label!'')?contains("Türkçe")>🇹🇷 TR
                        <#elseif (l.label!'')?contains("English")>🇬🇧 EN
                        <#elseif (l.label!'')?contains("Русский")>🇷🇺 RU
                        <#elseif (l.label!'')?contains("العربية")>🇸🇦 AR
                        <#elseif (l.label!'')?contains("Deutsch")>🇩🇪 DE
                        <#elseif (l.label!'')?contains("Français")>🇫🇷 FR
                        <#elseif (l.label!'')?contains("Polski")>🇵🇱 PL
                        <#elseif (l.label!'')?contains("Български")>🇧🇬 BG
                        <#else>${l.label!l.languageTag}
                        </#if>
                    </a>
                </#list>
            </nav>
        </#if>
    </header>

    <!-- Main Login Card -->
    <main class="mv-card-wrapper">
        <div class="mv-login-card">
            
            <div class="mv-card-header">
                <div class="mv-card-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>
                <h1 class="mv-card-title"><#nested "header"></h1>
                <p class="mv-card-desc">${msg("mvCardDesc")}</p>
            </div>

            <!-- Global Error / Warning Messages -->
            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="mv-alert <#if message.type = 'error'>mv-alert-error<#else>mv-alert-info</#if>">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 1px;">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" x2="12" y1="8" y2="12"/>
                        <line x1="12" x2="12.01" y1="16" y2="16"/>
                    </svg>
                    <span>${kcSanitize(message.summary)?no_esc}</span>
                </div>
            </#if>

            <!-- Render the Login Form -->
            <#nested "form">

            <!-- Optional Info / Registration / Social -->
            <#nested "info">
            <#nested "socialProviders">
        </div>
    </main>

    <!-- Footer -->
    <footer class="mv-footer">
        <div class="mv-footer-links">
            <a href="https://mertervitrini.com.tr" class="mv-footer-link">${msg("mvFooterStore")}</a>
            <span>•</span>
            <a href="https://mertervitrini.com.tr/tedarikci-basvuru" class="mv-footer-link">${msg("mvFooterApply")}</a>
            <span>•</span>
            <a href="https://mertervitrini.com.tr/iletisim" class="mv-footer-link">${msg("mvFooterSupport")}</a>
        </div>
        <div>
            ${msg("mvFooterCopyright")}
        </div>
    </footer>

</div>
</body>
</html>
</#macro>
