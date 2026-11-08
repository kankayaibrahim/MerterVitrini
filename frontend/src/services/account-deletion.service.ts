import { ApiError, FetchHttpClient, IHttpClient } from "./http-client";

export type AccountRole = "customer" | "supplier";

export interface DeleteAccountCommand {
  readonly role: AccountRole;
  readonly email: string;
  readonly password: string;
  readonly reason: string;
}

export interface DeleteAccountResult {
  readonly success: boolean;
  readonly message: string;
}

export interface IAccountDeletionService {
  authenticateAndDelete(command: DeleteAccountCommand): Promise<DeleteAccountResult>;
}

interface LoginTokenPayload {
  token?: string;
  error?: string;
}

interface DeleteAccountPayload {
  success?: boolean;
  message?: string;
  error?: string;
}

export class HttpAccountDeletionService implements IAccountDeletionService {
  constructor(private readonly http: IHttpClient = new FetchHttpClient()) {}

  async authenticateAndDelete(
    command: DeleteAccountCommand
  ): Promise<DeleteAccountResult> {
    let loginData: LoginTokenPayload;
    try {
      loginData = await this.http.post<LoginTokenPayload>(
        "/api/v1/mobile/auth/login",
        {
          email: command.email.trim(),
          password: command.password,
          role: command.role,
        }
      );
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw new Error(
          err.message ||
            "Kimlik doğrulaması başarısız oldu. E-posta veya şifrenizi kontrol edin."
        );
      }
      throw new Error(
        "Sunucu bağlantısı sırasında bir hata oluştu. Lütfen tekrar deneyin."
      );
    }

    if (!loginData.token) {
      throw new Error(
        loginData.error ??
          "Kimlik doğrulaması başarısız oldu. E-posta veya şifrenizi kontrol edin."
      );
    }

    try {
      const delData = await this.http.delete<DeleteAccountPayload>(
        "/api/v1/mobile/auth/account",
        { reason: command.reason.trim() },
        { Authorization: `Bearer ${loginData.token}` }
      );

      if (!delData.success) {
        throw new Error(delData.error ?? "Hesap silme işlemi tamamlanamadı.");
      }

      return {
        success: true,
        message:
          delData.message ??
          "Hesabınız ve kişisel verileriniz kalıcı olarak silindi.",
      };
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw new Error(err.message || "Hesap silme işlemi tamamlanamadı.");
      }
      if (err instanceof Error) {
        throw err;
      }
      throw new Error("Hesap silme işlemi tamamlanamadı.");
    }
  }
}

export const accountDeletionService: IAccountDeletionService =
  new HttpAccountDeletionService();

