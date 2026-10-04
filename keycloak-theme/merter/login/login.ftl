<#import "template.ftl" as layout>

<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
    <#if section = "header">
        ${msg("mvLoginHeader")}
    <#elseif section = "form">
        <#if realm.password>
            <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                
                <!-- Email / Username Input -->
                <#if !usernameHidden??>
                    <div class="mv-form-group">
                        <label for="username" class="mv-label">
                            <#if !realm.loginWithEmailAllowed>${msg("username")}<#else>${msg("mvEmailLabel")}</#if>
                        </label>
                        <div class="mv-input-wrapper">
                            <input tabindex="1" id="username" class="mv-input" name="username" 
                                   value="${(login.username!'')}" type="text" autofocus
                                   placeholder="ornek@tedarikci.com"
                                   autocomplete="username"
                                   aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                                   dir="ltr"
                            />
                        </div>
                        <#if messagesPerField.existsError('username','password')>
                            <span class="mv-input-error-msg" aria-live="polite">
                                ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                            </span>
                        </#if>
                    </div>
                </#if>

                <!-- Password Input -->
                <div class="mv-form-group">
                    <label for="password" class="mv-label">${msg("mvPasswordLabel")}</label>
                    <div class="mv-input-wrapper" dir="ltr">
                        <input tabindex="2" id="password" class="mv-input" name="password" type="password" 
                               placeholder="••••••••••••"
                               autocomplete="current-password"
                               aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                        />
                        <button type="button" class="mv-pw-toggle" id="mv-toggle-pw" tabindex="3" title="${msg('mvTogglePassword')}" aria-label="${msg('mvTogglePassword')}">
                            <svg id="mv-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Remember Me & Forgot Password Row -->
                <div class="mv-options-row">
                    <#if realm.rememberMe && !usernameHidden??>
                        <label class="mv-checkbox-label">
                            <input tabindex="4" id="rememberMe" name="rememberMe" type="checkbox" class="mv-checkbox" <#if login.rememberMe??>checked</#if>>
                            <span>${msg("mvRememberMe")}</span>
                        </label>
                    <#else>
                        <div></div>
                    </#if>

                    <#if realm.resetPasswordAllowed>
                        <a tabindex="5" href="${url.loginResetCredentialsUrl}" class="mv-forgot-link">${msg("mvForgotPassword")}</a>
                    </#if>
                </div>

                <!-- Hidden Credential ID -->
                <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>

                <!-- Submit Button -->
                <button tabindex="6" class="mv-btn-primary" name="login" id="kc-login" type="submit">
                    <span>${msg("mvSubmitBtn")}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14"/>
                        <path d="m12 5 7 7-7 7"/>
                    </svg>
                </button>

            </form>

            <script>
                // Password Toggle
                (function() {
                    var btn = document.getElementById('mv-toggle-pw');
                    var pw = document.getElementById('password');
                    if (btn && pw) {
                        btn.addEventListener('click', function() {
                            if (pw.type === 'password') {
                                pw.type = 'text';
                                btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
                            } else {
                                pw.type = 'password';
                                btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
                            }
                        });
                    }
                })();
            </script>
        </#if>

    <#elseif section = "info">
        <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
            <div style="text-align: center; margin-top: 1.5rem; font-size: 13px; color: #64748b;">
                ${msg("mvNoAccount")} <a href="${url.registrationUrl}" class="mv-forgot-link">${msg("mvApplyNow")}</a>
            </div>
        </#if>

    <#elseif section = "socialProviders">
        <#if realm.password && social?? && social.providers?has_content>
            <div style="margin-top: 1.5rem; border-top: 1px solid #e2e8f0; padding-top: 1.25rem;">
                <#list social.providers as p>
                    <a href="${p.loginUrl}" class="mv-btn-primary" style="background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; box-shadow: none; margin-bottom: 0.5rem;">
                        <span>${p.displayName!} ile Giriş Yap</span>
                    </a>
                </#list>
            </div>
        </#if>
    </#if>
</@layout.registrationLayout>
